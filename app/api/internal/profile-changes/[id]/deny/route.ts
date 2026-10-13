import { NextRequest, NextResponse } from "next/server";

import { requireAdminWrite } from "@/lib/admin-auth";
import { denyProfileChangeRequest } from "@/lib/profile-change-requests-server";
import { createServiceRoleClient } from "@/lib/supabase-service";

/** Denies a professional's name or photo change (founders only). Body: `{ reason }`. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server is not configured." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const result = await denyProfileChangeRequest(service, {
    requestId: params.id,
    adminId: admin.id,
    reason: body.reason,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "rejected" });
}
