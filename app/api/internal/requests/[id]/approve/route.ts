import { NextRequest, NextResponse } from "next/server";

import { requireAdminWrite } from "@/lib/admin-auth";
import { approveRegistrationRequest } from "@/lib/registration-requests";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Approves a professional_registration request (founders only). Body:
 * `{ details, trialMonths?, note? }`; details are the founders' reviewed version.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server is not configured." }, { status: 503 });

  let body: { details?: unknown; trialMonths?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const result = await approveRegistrationRequest(service, {
    requestId: params.id,
    adminId: admin.id,
    details: body.details,
    trialMonths: body.trialMonths,
    note: body.note,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ professionalId: result.professionalId, slug: result.slug });
}
