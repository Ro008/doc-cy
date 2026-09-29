import { NextRequest, NextResponse } from "next/server";

import { requireAdminWrite } from "@/lib/admin-auth";
import { denyRegistrationRequest } from "@/lib/registration-requests";
import { createServiceRoleClient } from "@/lib/supabase-service";

/** Denies a professional_registration request (founders only). Body: `{ reason }`. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server is not configured." }, { status: 503 });

  let body: { reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const result = await denyRegistrationRequest(service, {
    requestId: params.id,
    adminId: admin.id,
    reason: body.reason,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "rejected" });
}
