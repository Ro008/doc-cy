import { NextResponse } from "next/server";

import { PHOTO_CHANGE_REQUEST_TYPE } from "@/lib/profile-change-requests";
import { submitPhotoChangeRequest, withdrawProfileChangeRequest } from "@/lib/profile-change-requests-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Profile (user, 2026-10-10): a new photo goes live only once a founder
 * approves it. Until then it waits in the private bucket and the live photo stays.
 * - POST multipart { photo } → 201 { request: { id, createdAt, photoUrl } } · 400 not
 *   a usable image · 409 a request is already waiting
 * - DELETE withdraws her open request → 200 · 409 already decided
 * Both: 401 signed out · 403 not a professional.
 */
export async function POST(req: Request) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ message: "No photo was sent." }, { status: 400 });

  const result = await submitPhotoChangeRequest(service, { professionalId: pro.id, file });
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
    type: PHOTO_CHANGE_REQUEST_TYPE,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ status: "withdrawn" });
}
