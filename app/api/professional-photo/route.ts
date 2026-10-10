import { NextResponse } from "next/server";

import { removeProfessionalPhoto } from "@/lib/profile-change-requests-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Profile: the professional removes her photo. No founder is needed
 * (nothing new is shown); the removal is recorded in request_log.
 * - DELETE → 200 { removed } · 401 signed out · 403 not a professional
 */
export async function DELETE() {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await removeProfessionalPhoto(service, pro.id);
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ removed: result.removed });
}
