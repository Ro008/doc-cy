import { NextRequest, NextResponse } from "next/server";

import { addProfessionalQualification, removeProfessionalQualification } from "@/lib/profile-details-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { qualificationFromBody } from "@/lib/settings-profile-details";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Profile: qualifications (user, 2026-10-10). She adds and removes lines as
 * she pleases, no founder; each one is recorded (`professional_qualification_add` /
 * `_remove` make the change and its request_log row together).
 * - POST { title, institution, year? } → 201 { qualification: { id, title, institution, year } } ·
 *   400 not usable (with `errors` per field) · 409 already 6
 * - DELETE ?id=… → 200 · 400 no id · 404 not hers
 * Both: 401 signed out · 403 not a professional.
 */
export async function POST(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const check = qualificationFromBody(await req.json().catch(() => null));
  if (check.ok === false) {
    const message = Object.values(check.errors)[0] ?? "Check the qualification.";
    return NextResponse.json({ message, errors: check.errors }, { status: 400 });
  }
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await addProfessionalQualification(service, {
    professionalId: pro.id,
    qualification: check.qualification,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ qualification: result.qualification }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const qualificationId = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!qualificationId) return NextResponse.json({ message: "Missing id." }, { status: 400 });
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await removeProfessionalQualification(service, { professionalId: pro.id, qualificationId });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}
