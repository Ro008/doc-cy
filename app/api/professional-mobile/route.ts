import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  PROFESSIONAL_MOBILE_INVALID_MESSAGE,
  normalizeProfessionalMobile,
} from "@/lib/professional-mobile";
import {
  SETTINGS_MOBILE_IN_USE_MESSAGE,
  professionalContactUniqueViolation,
} from "@/lib/professional-contact";

/**
 * Settings → Account (user, 2026-10-09): the professional changes her personal mobile.
 * A real mobile for its country, as on /register; no founder, but recorded
 * (`professional_mobile_set` writes the change and its request_log row together).
 * When SMS 2FA arrives, the new number will need verifying first.
 * - 200 { changed, mobile } · 400 not a valid mobile · 401 signed out · 403 not a
 *   professional · 409 used by another professional
 */
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const { data: pro } = await supabase.from("professionals").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!pro?.id) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { mobile?: unknown } | null;
  const mobile = normalizeProfessionalMobile(body?.mobile);
  if (!mobile.ok) return NextResponse.json({ message: PROFESSIONAL_MOBILE_INVALID_MESSAGE }, { status: 400 });

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const { data: requestId, error } = await service.rpc("professional_mobile_set", {
    p_professional_id: pro.id,
    p_mobile_number: mobile.e164,
  });
  if (professionalContactUniqueViolation(error) === "mobile") {
    return NextResponse.json({ message: SETTINGS_MOBILE_IN_USE_MESSAGE }, { status: 409 });
  }
  if (error?.code === "22023") {
    return NextResponse.json({ message: PROFESSIONAL_MOBILE_INVALID_MESSAGE }, { status: 400 });
  }
  if (error) {
    console.error("[DocCy] professional mobile change", error);
    return NextResponse.json({ message: "Could not save. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ changed: Boolean(requestId), mobile: mobile.e164 });
}
