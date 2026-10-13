import { NextResponse } from "next/server";

import { CLINIC_ADD_REQUEST_TYPE } from "@/lib/clinic-requests";
import { submitClinicAddRequest, withdrawClinicRequest } from "@/lib/clinic-requests-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Clinics (user, 2026-10-11): a clinic DocCy does not have yet needs a
 * founder. (A clinic DocCy has is joined at once: POST /api/professional-clinics.)
 * One request waiting at a time; at most 5 clinics.
 * - POST { clinic: { name, phone, location: { address, district, town, latitude,
 *   longitude, placeId } } } → 201 { request: { id, createdAt, name, address } } ·
 *   400 not usable · 409 a request is already waiting, or she has 5 clinics
 * - DELETE withdraws her waiting request → 200 · 409 already decided
 * Both: 401 signed out · 403 not a professional.
 */
export async function POST(req: Request) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { clinic?: unknown } | null;
  const result = await submitClinicAddRequest(service, { professionalId: pro.id, clinic: body?.clinic });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ request: result.request }, { status: 201 });
}

export async function DELETE() {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await withdrawClinicRequest(service, { professionalId: pro.id, type: CLINIC_ADD_REQUEST_TYPE });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "withdrawn" });
}
