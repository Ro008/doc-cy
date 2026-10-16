import { NextResponse } from "next/server";

import { requireAdminWrite } from "@/lib/admin-auth";
import { moderateReview } from "@/lib/review-moderation-server";
import { createServiceRoleClient } from "@/lib/supabase-service";

/** Rejects a patient review (founders only): final, never shown, nobody is told. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { admin, response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server is not configured." }, { status: 503 });

  const result = await moderateReview(service, { reviewId: params.id, adminId: admin.id, action: "reject" });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: result.status });
}
