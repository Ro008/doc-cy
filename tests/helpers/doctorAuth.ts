import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

const TEST_USER_EMAIL = normalizeSecret(process.env.TEST_USER_EMAIL ?? "");
const TEST_USER_PASSWORD = normalizeSecret(process.env.TEST_USER_PASSWORD ?? "");

type DoctorAuthResult = {
  authUserId: string;
  // Useful when callers need to query doctor-specific rows.
  sessionAccessToken: string;
};

type DoctorAuthOptions = {
  email?: string;
  password?: string;
};

function chunkString(value: string, chunkSize: number): string[] {
  if (value.length <= chunkSize) return [value];
  return value.match(new RegExp(`.{1,${chunkSize}}`, "g")) ?? [];
}

/**
 * Programmatic doctor login for Playwright:
 * - Uses Supabase `signInWithPassword` (server-side, deterministic).
 * - Injects the Supabase auth session cookies in the browser.
 *
 * This avoids flakiness from UI form submit + middleware redirects.
 */
export async function signInDoctorAndSetCookies(
  page: Page,
  supabaseClient?: SupabaseClient,
  options?: DoctorAuthOptions
): Promise<DoctorAuthResult> {
  // Cookie domain must match the site the test is running against.
  // - Local: http://localhost:3000  -> domain must be "localhost"
  // - Staging/Prod: https://mydoccy.com -> domain must match that hostname
  const configuredBaseUrl =
    process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const cookieDomain = new URL(configuredBaseUrl).hostname;
  const isHttps = configuredBaseUrl.startsWith("https://");

  const supabaseUrl =
    process.env.PLAYWRIGHT_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey =
    process.env.PLAYWRIGHT_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  const loginEmail = normalizeSecret(options?.email ?? TEST_USER_EMAIL);
  const loginPassword = normalizeSecret(options?.password ?? TEST_USER_PASSWORD);
  if (!loginEmail || !loginPassword) {
    throw new Error("Missing TEST_USER_EMAIL / TEST_USER_PASSWORD");
  }

  const supabase =
    supabaseClient ?? createClient(supabaseUrl, supabaseAnonKey);

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

  if (signInError) {
    throw signInError;
  }

  const session = signInData?.session;
  const authUserId =
    signInData?.user?.id ?? session?.user?.id ?? (session as any)?.user?.id;

  if (!session || !authUserId) {
    throw new Error("Supabase sign-in succeeded but session/user missing.");
  }

  // Supabase auth helpers store the session in a cookie keyed by `storageKey`:
  // sb-${baseUrl.hostname.split(".")[0]}-auth-token
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

  // @supabase/auth-helpers-shared stringifySupabaseSession(session)
  // => JSON.stringify([ access_token, refresh_token, provider_token, provider_refresh_token, factors ])
  const sessionCookieValue = JSON.stringify([
    session.access_token,
    session.refresh_token,
    (session as any).provider_token,
    (session as any).provider_refresh_token,
    session.user?.factors ?? null,
  ]);

  const chunkSize = 3180; // matches @supabase/auth-helpers-shared MAX_CHUNK_SIZE
  const chunks = chunkString(sessionCookieValue, chunkSize);

  await page.context().addCookies(
    chunks.map((chunkValue, idx) => {
      const name = chunks.length === 1 ? storageKey : `${storageKey}.${idx}`;
      return {
        name,
        value: chunkValue,
        httpOnly: true,
        secure: isHttps,
        sameSite: "Lax",
        domain: cookieDomain,
        path: "/",
      };
    })
  );

  return { authUserId, sessionAccessToken: session.access_token };
}

