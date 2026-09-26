import { NextResponse } from "next/server";
import { adminCanWrite, adminDenialStatus, getAdminAccess } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * The signed-in admin, or why not. The sign-in page uses `reason` to pick its
 * next step (password, authenticator code, refused).
 */
export async function GET() {
  const access = await getAdminAccess("route");
  if ("reason" in access) {
    return NextResponse.json(
      { ok: false, reason: access.reason },
      { status: adminDenialStatus(access.reason), headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      name: access.admin.name,
      email: access.admin.email,
      role: access.admin.role,
      canWrite: adminCanWrite(access.admin),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
