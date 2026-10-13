import { NextResponse } from "next/server";

import { loadClinicUpcomingCounts } from "@/lib/professional-clinics-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/**
 * What is still coming at one of her clinics, for the "Leave clinic" dialog in Settings
 * (user, 2026-10-11): she is told before leaving, and nothing is cancelled.
 * GET → 200 { confirmed, open } · 401 signed out · 403 not a professional · 404 not hers.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const linkId = String(params.id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return NextResponse.json({ message: "Not found." }, { status: 404 });
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const counts = await loadClinicUpcomingCounts(service, { professionalId: pro.id, linkId });
  if (!counts) return NextResponse.json({ message: "Not found." }, { status: 404 });
  return NextResponse.json(counts, { headers: { "Cache-Control": "no-store" } });
}
