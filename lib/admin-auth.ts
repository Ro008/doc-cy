import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  adminDenialStatus,
  decideAdminWriteAccess,
  resolveAdminAccess,
  supabaseAdminAccessDeps,
  type AdminAccess,
  type AdminUserRow,
} from "@/lib/admin-auth-core";

export {
  ADMIN_MFA_MAX_AGE_SECONDS,
  adminCanWrite,
  adminDenialStatus,
  type AdminAccess,
  type AdminAccessDenial,
  type AdminRole,
  type AdminUserRow,
} from "@/lib/admin-auth-core";

/**
 * Admin access for the current request: a signed-in Supabase user with an active
 * `admin_users` row and a TOTP code verified within 7 days (`aal2`). A professional's
 * login is refused. `admin_users` is service role only.
 */
export async function getAdminAccess(): Promise<AdminAccess> {
  const service = createServiceRoleClient();
  if (!service) return { ok: false, reason: "unavailable" };
  const supabase = createServerComponentClient({ cookies });
  return resolveAdminAccess(supabaseAdminAccessDeps(supabase, service));
}

type RequireAdminResult =
  | { admin: AdminUserRow; response: null }
  | { admin: null; response: NextResponse };

function toRequireAdminResult(access: AdminAccess): RequireAdminResult {
  if (!("reason" in access)) return { admin: access.admin, response: null };
  const message =
    access.reason === "read_only"
      ? "Partner access is read-only. Ask a founder to make this change."
      : "Admin sign-in required.";
  return {
    admin: null,
    response: NextResponse.json(
      { message, reason: access.reason },
      { status: adminDenialStatus(access.reason) },
    ),
  };
}

/** For API routes that only read: any active admin (founder or partner). */
export async function requireAdmin(): Promise<RequireAdminResult> {
  return toRequireAdminResult(await getAdminAccess());
}

/** For API routes that change data: founders only; partners get 403 `read_only`. */
export async function requireAdminWrite(): Promise<RequireAdminResult> {
  return toRequireAdminResult(decideAdminWriteAccess(await getAdminAccess()));
}
