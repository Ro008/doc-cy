import { NextRequest, NextResponse } from "next/server";

import { setProfessionalGesy } from "@/lib/profile-change-requests-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Profile: "I see GeSY patients" on or off (user, 2026-10-10). She changes
 * it as she pleases, no founder either way; every change is recorded
 * (`professional_gesy_set` makes the change and its request_log row together).
 * - POST { isGesy } → 200 { isGesy, changed } · 400 no value · 401 signed out ·
 *   403 not a professional
 */
export async function POST(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const body = (await req.json().catch(() => null)) as { isGesy?: unknown } | null;
  if (typeof body?.isGesy !== "boolean") {
    return NextResponse.json({ message: "Missing isGesy boolean." }, { status: 400 });
  }
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await setProfessionalGesy(service, { professionalId: pro.id, isGesy: body.isGesy });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ isGesy: body.isGesy, changed: result.changed });
}
