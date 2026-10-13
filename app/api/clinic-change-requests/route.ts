import { NextRequest, NextResponse } from "next/server";

import { CLINIC_DETAILS_REQUEST_TYPE } from "@/lib/clinic-requests";
import { submitClinicDetailsRequest, withdrawClinicRequest } from "@/lib/clinic-requests-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Clinics (user, 2026-10-11): the name, address or phone of a clinic she
 * works at changes by request, because the clinic is shared. One open request per
 * clinic, covering whatever she changed.
 * - POST { locationId, changes: { name?, address? + location?, phone? } } → 201
 *   { request: { id, createdAt, changes } } · 400 not usable, or nothing differs ·
 *   404 not her clinic · 409 a request for this clinic is already waiting
 * - DELETE ?locationId=… withdraws it → 200 · 404 not her clinic · 409 already decided
 * Both: 401 signed out · 403 not a professional.
 */
export async function POST(req: Request) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { locationId?: unknown; changes?: unknown } | null;
  const linkId = typeof body?.locationId === "string" ? body.locationId.trim() : "";
  if (!linkId) return NextResponse.json({ message: "Missing locationId." }, { status: 400 });
  const result = await submitClinicDetailsRequest(service, {
    professionalId: pro.id,
    linkId,
    changes: body?.changes,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ request: result.request }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const linkId = new URL(req.url).searchParams.get("locationId")?.trim() ?? "";
  if (!linkId) return NextResponse.json({ message: "Missing locationId." }, { status: 400 });
  const result = await withdrawClinicRequest(service, {
    professionalId: pro.id,
    type: CLINIC_DETAILS_REQUEST_TYPE,
    linkId,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "withdrawn" });
}
