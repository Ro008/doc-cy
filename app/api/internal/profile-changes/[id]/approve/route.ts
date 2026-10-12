import { NextRequest, NextResponse } from "next/server";

import { requireAdminWrite } from "@/lib/admin-auth";
import { approveProfileChangeRequest } from "@/lib/profile-change-requests-server";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Approves a professional's name, photo or specialty request (founders only). Body:
 * `{ name?, licenseNumber?, note? }`: the founders' corrected name (or specialty) and
 * licence number, when they changed them.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server is not configured." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; licenseNumber?: unknown; note?: unknown };
  const result = await approveProfileChangeRequest(service, {
    requestId: params.id,
    adminId: admin.id,
    name: body.name,
    licenseNumber: body.licenseNumber,
    note: body.note,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "approved", kind: result.kind });
}
