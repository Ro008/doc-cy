/**
 * Admin access rules, free of Next.js imports so they can be unit tested.
 * An admin is a Supabase login with an active `admin_users` row, signed in with a
 * second factor (TOTP, `aal2`) verified within the last 7 days. A professional's
 * login is never an admin, even with a row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** How long a verified 2FA code keeps an admin signed in. */
export const ADMIN_MFA_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Allowed clock skew between GoTrue's timestamps and this server. */
const CLOCK_SKEW_SECONDS = 5 * 60;

export type AdminRole = "founder" | "partner";

export type AdminUserRow = {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
};

export const ADMIN_USER_SELECT = "id, auth_user_id, name, email, role, is_active";

export type AdminIdentity = {
  userId: string;
  aal: string | null;
  amr: unknown;
};

export type AdminAccessDenial =
  | "signed_out"
  | "professional_account"
  | "not_admin"
  | "inactive"
  | "mfa_required"
  | "mfa_expired"
  | "unavailable";

export type AdminAccess =
  | { ok: true; admin: AdminUserRow; mfaVerifiedAt: number }
  | { ok: false; reason: AdminAccessDenial };

/** Newest TOTP verification time (Unix seconds) in a JWT `amr` claim, or null. */
export function lastTotpVerifiedAt(amr: unknown): number | null {
  if (!Array.isArray(amr)) return null;
  let latest: number | null = null;
  for (const entry of amr) {
    if (!entry || typeof entry !== "object") continue;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if (method !== "totp" || typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
      continue;
    }
    if (latest === null || timestamp > latest) latest = timestamp;
  }
  return latest;
}

export function decideAdminAccess(input: {
  identity: AdminIdentity | null;
  admin: AdminUserRow | null;
  isProfessional: boolean;
  nowSeconds: number;
}): AdminAccess {
  const { identity, admin, isProfessional, nowSeconds } = input;
  if (!identity) return { ok: false, reason: "signed_out" };
  if (isProfessional) return { ok: false, reason: "professional_account" };
  if (!admin || admin.auth_user_id !== identity.userId) {
    return { ok: false, reason: "not_admin" };
  }
  if (!admin.is_active) return { ok: false, reason: "inactive" };

  const verifiedAt = identity.aal === "aal2" ? lastTotpVerifiedAt(identity.amr) : null;
  if (verifiedAt === null || verifiedAt > nowSeconds + CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "mfa_required" };
  }
  if (nowSeconds - verifiedAt > ADMIN_MFA_MAX_AGE_SECONDS) {
    return { ok: false, reason: "mfa_expired" };
  }
  return { ok: true, admin, mfaVerifiedAt: verifiedAt };
}

/** HTTP status for a refused admin request. */
export function adminDenialStatus(reason: AdminAccessDenial): 401 | 403 | 503 {
  switch (reason) {
    case "signed_out":
    case "mfa_required":
    case "mfa_expired":
      return 401;
    case "unavailable":
      return 503;
    default:
      return 403;
  }
}

/** Payload of a JWT, without verifying it. Only use on a token the server verified. */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const claims: unknown = JSON.parse(json);
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;
    return claims as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type AdminAccessDeps = {
  /** The session's access token from the request cookies, if any. */
  readAccessToken: () => Promise<string | null>;
  /** Asks Supabase Auth to verify the token; returns its user id, or null if rejected. */
  verifyUserId: (token: string) => Promise<string | null>;
  loadAdminRow: (authUserId: string) => Promise<AdminUserRow | null>;
  isProfessionalAccount: (authUserId: string) => Promise<boolean>;
  nowSeconds: () => number;
};

/**
 * The real lookups: `auth` is a client carrying the user's session (cookies in the
 * app), `service` a service-role client (`admin_users` has no grants for users).
 */
export function supabaseAdminAccessDeps(
  auth: SupabaseClient,
  service: SupabaseClient,
): AdminAccessDeps {
  return {
    readAccessToken: async () => {
      const { data } = await auth.auth.getSession();
      return data.session?.access_token ?? null;
    },
    verifyUserId: async (token) => {
      const { data, error } = await auth.auth.getUser(token);
      if (error || !data.user) return null;
      return data.user.id;
    },
    loadAdminRow: async (authUserId) => {
      const { data, error } = await service
        .from("admin_users")
        .select(ADMIN_USER_SELECT)
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as AdminUserRow | null) ?? null;
    },
    isProfessionalAccount: async (authUserId) => {
      const { data, error } = await service
        .from("professionals")
        .select("id")
        .eq("auth_user_id", authUserId)
        .limit(1);
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    nowSeconds: () => Math.floor(Date.now() / 1000),
  };
}

/**
 * Resolves the request's admin access. `aal` and `amr` come from the same token
 * Supabase Auth just verified, so they can't be forged. Any lookup error fails closed.
 */
export async function resolveAdminAccess(deps: AdminAccessDeps): Promise<AdminAccess> {
  try {
    const token = await deps.readAccessToken();
    if (!token) return { ok: false, reason: "signed_out" };
    const claims = decodeJwtClaims(token);
    if (!claims || typeof claims.sub !== "string") return { ok: false, reason: "signed_out" };

    const userId = await deps.verifyUserId(token);
    if (!userId || userId !== claims.sub) return { ok: false, reason: "signed_out" };

    const [admin, isProfessional] = await Promise.all([
      deps.loadAdminRow(userId),
      deps.isProfessionalAccount(userId),
    ]);
    return decideAdminAccess({
      identity: {
        userId,
        aal: typeof claims.aal === "string" ? claims.aal : null,
        amr: claims.amr,
      },
      admin,
      isProfessional,
      nowSeconds: deps.nowSeconds(),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
