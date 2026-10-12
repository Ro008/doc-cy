import { NextResponse } from "next/server";

import { loadVisitsLeftOutsideHours } from "@/lib/clinic-hours-visits-server";
import type { WeeklySchedule } from "@/lib/doctor-settings";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const MAX_CLINICS = 10;

function isWeek(value: unknown): value is WeeklySchedule {
  if (!value || typeof value !== "object") return false;
  return DAYS.every((day) => {
    const entry = (value as Record<string, unknown>)[day];
    return Boolean(entry) && typeof entry === "object" && typeof (entry as { enabled?: unknown }).enabled === "boolean";
  });
}

/**
 * Before she saves new hours in Settings (user, 2026-10-11): which confirmed visits and
 * open requests the new week would leave outside her hours, clinic by clinic. Only a
 * warning: nothing is saved or cancelled here.
 * POST { clinics: [{ locationId, weeklySchedule }] } → 200 { clinics: [{ locationId,
 * clinicName, confirmed, open, visits }] } · 400 bad body · 401 signed out · 403 not a
 * professional. A clinic that is not hers is left out of the answer.
 */
export async function POST(req: Request) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const body = (await req.json().catch(() => null)) as { clinics?: unknown } | null;
  const sent = Array.isArray(body?.clinics) ? body!.clinics.slice(0, MAX_CLINICS) : null;
  if (!sent) return NextResponse.json({ message: "Missing clinics." }, { status: 400 });
  const clinics: Array<{ locationId: string; week: WeeklySchedule }> = [];
  for (const entry of sent as Array<{ locationId?: unknown; weeklySchedule?: unknown }>) {
    const locationId = String(entry?.locationId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(locationId) || !isWeek(entry?.weeklySchedule)) {
      return NextResponse.json({ message: "Each clinic needs its week." }, { status: 400 });
    }
    clinics.push({ locationId, week: entry.weeklySchedule });
  }
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const checked = await loadVisitsLeftOutsideHours(service, { professionalId: pro.id, clinics });
  return NextResponse.json({ clinics: checked }, { headers: { "Cache-Control": "no-store" } });
}
