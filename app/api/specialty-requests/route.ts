import { NextResponse } from "next/server";

import { SPECIALTY_ADD_REQUEST_TYPE } from "@/lib/profile-change-requests";
import { submitSpecialtyAddRequest, withdrawProfileChangeRequest } from "@/lib/profile-change-requests-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Profile (user, 2026-10-10): adding a specialty, from the catalogue or
 * new, needs a founder, as at registration. The licence number is required and kept
 * in the request. One open request at a time; at most 5 specialties.
 * - POST { toSpecialty, toSpecialtyFromMaster, licenseNumber } → 201
 *   { request: { id, specialty, licenseNumber, createdAt } } · 400 not usable ·
 *   409 a request is already waiting
 * - DELETE withdraws her open request → 200 · 409 already decided
 * Both: 401 signed out · 403 not a professional.
 */
export async function POST(req: Request) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as {
    toSpecialty?: unknown;
    toSpecialtyFromMaster?: unknown;
    licenseNumber?: unknown;
  } | null;
  const result = await submitSpecialtyAddRequest(service, {
    professionalId: pro.id,
    specialty: body?.toSpecialty,
    fromCatalogue: body?.toSpecialtyFromMaster,
    licenseNumber: body?.licenseNumber,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ request: result.request }, { status: 201 });
}

export async function DELETE() {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await withdrawProfileChangeRequest(service, {
    professionalId: pro.id,
    type: SPECIALTY_ADD_REQUEST_TYPE,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "withdrawn" });
}
