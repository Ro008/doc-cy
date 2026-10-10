import { NextRequest, NextResponse } from "next/server";

import { requireAdminWrite } from "@/lib/admin-auth";
import { approveNameChangeRequest } from "@/lib/profile-change-requests-server";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Approves a professional's name change (founders only). Body: `{ name?, note? }`;
 * `name` is the founders' corrected spelling, when they changed it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server is not configured." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; note?: unknown };
  const result = await approveNameChangeRequest(service, {
    requestId: params.id,
    adminId: admin.id,
    name: body.name,
    note: body.note,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "approved", name: result.name, slug: result.slug });
}
