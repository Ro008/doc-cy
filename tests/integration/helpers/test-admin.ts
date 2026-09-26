import { randomUUID } from "node:crypto";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { totpCode } from "../../../scripts/lib/totp.mjs";

export { totpCode };

/**
 * Real admin accounts for integration specs: a Supabase login, an `admin_users`
 * row and, when asked, a verified TOTP factor (aal2), exactly as a person gets
 * them. Emails end in `@integration.test`, so `scripts/cleanup-test-doctors.mjs`
 * (CI's cleanup job) removes anything a crashed spec leaves behind.
 */

export const TEST_ADMIN_EMAIL_DOMAIN = "integration.test";

export type TestAdmin = {
  adminId: string;
  authUserId: string;
  email: string;
  password: string;
  name: string;
  /** Base32 TOTP secret, when the admin enrolled an authenticator app. */
  totpSecret: string | null;
  /** aal2 session, when the admin enrolled and verified a code. */
  session: Session | null;
};

function env() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  }
  if (/oiwlztcduxojadbcxkil/.test(supabaseUrl)) {
    throw new Error("Refusing to create test admins on Production.");
  }
  return { supabaseUrl, anonKey, serviceKey };
}

export function createServiceClient(): SupabaseClient {
  const { supabaseUrl, serviceKey } = env();
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(): SupabaseClient {
  const { supabaseUrl, anonKey } = env();
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Creates a login + admin row. With `withTotp`, also signs in, enrols a TOTP
 * factor and verifies a code, returning the aal2 session.
 */
export async function createTestAdmin(options: {
  role?: "founder" | "partner";
  withTotp?: boolean;
  isActive?: boolean;
  service?: SupabaseClient;
} = {}): Promise<TestAdmin> {
  const service = options.service ?? createServiceClient();
  const tag = randomUUID().slice(0, 8);
  const email = `admin-${tag}@${TEST_ADMIN_EMAIL_DOMAIN}`;
  const password = `Adm1n-${randomUUID()}`;
  const name = `Test Admin ${tag}`;

  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    throw new Error(`Failed creating admin login: ${created.error?.message ?? "no user"}`);
  }
  const authUserId = created.data.user.id;

  const row = await service
    .from("admin_users")
    .insert({
      auth_user_id: authUserId,
      name,
      email,
      role: options.role ?? "founder",
      is_active: options.isActive ?? true,
    })
    .select("id")
    .single();
  if (row.error || !row.data) {
    await service.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed creating admin row: ${row.error?.message ?? "no row"}`);
  }

  const admin: TestAdmin = {
    adminId: String(row.data.id),
    authUserId,
    email,
    password,
    name,
    totpSecret: null,
    session: null,
  };
  if (!options.withTotp) return admin;

  const user = createUserClient();
  const signIn = await user.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`Admin sign-in failed: ${signIn.error.message}`);
  const enrolled = await user.auth.mfa.enroll({ factorType: "totp" });
  if (enrolled.error || !enrolled.data) {
    throw new Error(`TOTP enrol failed: ${enrolled.error?.message ?? "no factor"}`);
  }
  const verified = await user.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totpCode(enrolled.data.totp.secret),
  });
  if (verified.error) throw new Error(`TOTP verify failed: ${verified.error.message}`);
  const { data } = await user.auth.getSession();
  admin.totpSecret = enrolled.data.totp.secret;
  admin.session = data.session;
  return admin;
}

/** Deletes the admin row, then the login (the row blocks deleting the login). */
export async function deleteTestAdmin(admin: TestAdmin | null, service?: SupabaseClient) {
  if (!admin) return;
  const client = service ?? createServiceClient();
  await client.from("admin_users").delete().eq("id", admin.adminId);
  await client.auth.admin.deleteUser(admin.authUserId);
}

function authCookieName(): string {
  const { supabaseUrl } = env();
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/** The auth-helpers cookies for a session (same format and chunking as a real sign-in). */
export function sessionCookies(session: Session): Array<{ name: string; value: string }> {
  const value = JSON.stringify([
    session.access_token,
    session.refresh_token,
    session.provider_token ?? null,
    session.provider_refresh_token ?? null,
    session.user?.factors ?? null,
  ]);
  const chunkSize = 3180; // @supabase/auth-helpers-shared MAX_CHUNK_SIZE
  const name = authCookieName();
  if (value.length <= chunkSize) return [{ name, value }];
  const cookies: Array<{ name: string; value: string }> = [];
  for (let i = 0; i * chunkSize < value.length; i += 1) {
    cookies.push({ name: `${name}.${i}`, value: value.slice(i * chunkSize, (i + 1) * chunkSize) });
  }
  return cookies;
}

/** `Cookie` header value for API requests made as this admin. */
export function adminCookieHeader(admin: TestAdmin): string {
  if (!admin.session) throw new Error("Test admin has no aal2 session (create it withTotp).");
  return sessionCookies(admin.session)
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

let sharedFounder: Promise<TestAdmin> | null = null;

/**
 * One founder with an aal2 session per test worker, for specs that only need to
 * call admin APIs. Removed by the cleanup job (its email is a test email).
 */
export function sharedTestFounder(): Promise<TestAdmin> {
  if (!sharedFounder) {
    sharedFounder = createTestAdmin({ role: "founder", withTotp: true }).catch((error) => {
      sharedFounder = null;
      throw error;
    });
  }
  return sharedFounder;
}
