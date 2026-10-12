import { NextRequest, NextResponse } from "next/server";

import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { joinProfessionalClinic, leaveProfessionalClinic } from "@/lib/professional-clinics-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { loadSettingsClinicPhones } from "@/lib/settings-clinic-phones";
import { settingsWorkplaceFromLocation } from "@/lib/settings-workplace";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Clinics (user, 2026-10-11). She joins a clinic DocCy already has, and
 * leaves one, at once: no founder, each recorded (`professional_clinic_join` / `_leave`
 * make the change and its request_log row together).
 * - POST { clinicId } → 201 { location, phone } (the new clinic card: online booking is
 *   off there until she switches it on) · 400 no clinic · 404 not a DocCy clinic ·
 *   409 already hers, or she has 5 clinics
 * - DELETE ?locationId=… (her link to the clinic) → 200 · 400 no id · 404 not hers ·
 *   409 it is her last clinic. Visits at the clinic are kept.
 * All: 401 signed out · 403 not a professional.
 */
export async function POST(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const body = await req.json().catch(() => null);
  const clinicId = typeof body?.clinicId === "string" ? body.clinicId.trim() : "";
  if (!clinicId) return NextResponse.json({ message: "Pick a clinic first." }, { status: 400 });
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await joinProfessionalClinic(service, { professionalId: pro.id, clinicId });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });

  const [locations, phones] = await Promise.all([loadDoctorLocations(pro.id), loadSettingsClinicPhones(pro.id)]);
  const location = locations.find((row) => row.id === result.linkId);
  if (!location) {
    // Joined, but the card could not be read back: the page shows it on reload.
    console.error("[DocCy] clinic join: joined link not found", result.linkId);
    return NextResponse.json({ location: null, phone: null }, { status: 201 });
  }
  return NextResponse.json(
    {
      location: settingsWorkplaceFromLocation(location),
      phone: phones.find((entry) => entry.locationId === result.linkId) ?? null,
    },
    { status: 201 },
  );
}

export async function DELETE(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const linkId = new URL(req.url).searchParams.get("locationId")?.trim() ?? "";
  if (!linkId) return NextResponse.json({ message: "Missing locationId." }, { status: 400 });
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await leaveProfessionalClinic(service, { professionalId: pro.id, linkId });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}
