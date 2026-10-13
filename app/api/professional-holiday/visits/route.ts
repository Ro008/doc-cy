import { NextResponse } from "next/server";

import { loadHolidayVisits } from "@/lib/professional-holiday-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What is still coming inside the holiday dates she is about to save in Settings (user,
 * 2026-10-11): she is warned first, and nothing is cancelled.
 * GET ?start=YYYY-MM-DD&end=YYYY-MM-DD → 200 { confirmed, open, visits } · 400 bad dates ·
 * 401 signed out · 403 not a professional.
 */
export async function GET(req: Request) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const { searchParams } = new URL(req.url);
  const start = String(searchParams.get("start") ?? "");
  const end = String(searchParams.get("end") ?? "");
  if (!DAY.test(start) || !DAY.test(end) || start > end) {
    return NextResponse.json({ message: "Pick both holiday dates." }, { status: 400 });
  }
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const visits = await loadHolidayVisits(service, { professionalId: pro.id, start, end });
  return NextResponse.json(visits, { headers: { "Cache-Control": "no-store" } });
}
