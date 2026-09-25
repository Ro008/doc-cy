import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  adminDenialStatus,
  resolveAdminAccess,
  supabaseAdminAccessDeps,
  type AdminAccess,
  type AdminUserRow,
} from "@/lib/admin-auth-core";

export {
  ADMIN_MFA_MAX_AGE_SECONDS,
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

/** For API routes: the admin, or the response to return instead. */
export async function requireAdmin(): Promise<
  { admin: AdminUserRow; response: null } | { admin: null; response: NextResponse }
> {
  const access = await getAdminAccess();
  if (!("reason" in access)) return { admin: access.admin, response: null };
  return {
    admin: null,
    response: NextResponse.json(
      { message: "Admin sign-in required.", reason: access.reason },
      { status: adminDenialStatus(access.reason) },
    ),
  };
}
