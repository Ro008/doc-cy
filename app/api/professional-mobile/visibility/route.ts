import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Account (user, 2026-10-09): show or hide the personal mobile on the public
 * profile. Off by default; no founder, but recorded
 * (`professional_mobile_visibility_set` writes the switch and its request_log row together).
 * - 200 { changed, show } · 400 show is not true/false · 401 signed out · 403 not a
 *   professional · 409 no saved mobile to show
 */
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const { data: pro } = await supabase.from("professionals").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!pro?.id) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { show?: unknown } | null;
  if (typeof body?.show !== "boolean") {
    return NextResponse.json({ message: "show must be true or false." }, { status: 400 });
  }
  const show = body.show;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const { data: requestId, error } = await service.rpc("professional_mobile_visibility_set", {
    p_professional_id: pro.id,
    p_show: show,
  });
  if (error?.code === "22023") {
    return NextResponse.json({ message: "Save your mobile first." }, { status: 409 });
  }
  if (error) {
    console.error("[DocCy] professional mobile visibility", error);
    return NextResponse.json({ message: "Could not save. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ changed: Boolean(requestId), show });
}
