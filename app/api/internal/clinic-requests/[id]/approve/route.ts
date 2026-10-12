import { NextRequest, NextResponse } from "next/server";

import { requireAdminWrite } from "@/lib/admin-auth";
import { approveClinicRequest } from "@/lib/clinic-requests-server";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Approves a professional's clinic request (founders only). Body:
 * `{ name?, address?, phone?, existingClinicId?, note? }`: the founders' corrections,
 * or, for a new clinic DocCy already has, the clinic she is joined to instead.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server is not configured." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await approveClinicRequest(service, {
    requestId: params.id,
    adminId: admin.id,
    name: body.name,
    address: body.address,
    phone: body.phone,
    existingClinicId: body.existingClinicId,
    note: body.note,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "approved", kind: result.kind });
}
