import { NextResponse } from "next/server";

import { removeProfessionalSpecialty } from "@/lib/profile-change-requests-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Profile (user, 2026-10-10): the professional removes a specialty. No
 * founder is needed; the removal is recorded. Never her last one: she adds the new
 * one first, then removes the old one.
 * - DELETE { specialty } → 200 { specialties } (the ones left) · 404 not hers ·
 *   409 her last one · 401 signed out · 403 not a professional
 */
export async function DELETE(req: Request) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { specialty?: unknown } | null;
  const result = await removeProfessionalSpecialty(service, { professionalId: pro.id, specialty: body?.specialty });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ specialties: result.specialties });
}
