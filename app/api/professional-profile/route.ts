import { NextRequest, NextResponse } from "next/server";

import { setProfessionalPatientAges } from "@/lib/profile-details-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { parsePatientAges } from "@/lib/settings-profile-details";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Profile: "Patients I see" (user, 2026-10-10). She changes it as she
 * pleases, no founder; every change is recorded (`professional_patients_seen_set`
 * makes the change and its request_log row together).
 * - PUT { patientAges: "adults" | "children" | "all" } → 200 { patientAges, changed } ·
 *   400 not one of the three · 401 signed out · 403 not a professional
 */
export async function PUT(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const body = (await req.json().catch(() => null)) as { patientAges?: unknown } | null;
  const patientAges = parsePatientAges(body?.patientAges);
  if (!patientAges) {
    return NextResponse.json({ message: "Choose adults, children, or adults and children." }, { status: 400 });
  }
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await setProfessionalPatientAges(service, { professionalId: pro.id, patientAges });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ patientAges, changed: result.changed });
}
