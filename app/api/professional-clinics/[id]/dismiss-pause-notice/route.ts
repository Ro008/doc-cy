import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { createServiceRoleClient } from "@/lib/supabase-service";

type RouteContext = { params: { id: string } };

/**
 * The "x" on a dashboard paused line (user, 2026-10-03): hides it until that clinic's pause
 * changes (a trigger clears pause_notice_dismissed_at). Only her own clinic, only while paused.
 * - 200 dismissed · 401 signed out · 404 not her clinic · 409 not paused
 */
export async function POST(_req: Request, { params }: RouteContext) {
  const linkId = String(params.id ?? "").trim();
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const { data: pro } = await supabase.from("professionals").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!pro?.id) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return NextResponse.json({ message: "Not found." }, { status: 404 });
  const { data: link } = await service
    .from("professional_clinics")
    .select("id, pause_online_bookings")
    .eq("id", linkId)
    .eq("professional_id", pro.id)
    .maybeSingle();
  if (!link) return NextResponse.json({ message: "Not found." }, { status: 404 });
  if (!link.pause_online_bookings) {
    return NextResponse.json({ message: "Online bookings aren't paused at this clinic." }, { status: 409 });
  }

  const { error } = await service
    .from("professional_clinics")
    .update({ pause_notice_dismissed_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("professional_id", pro.id)
    .eq("pause_online_bookings", true);
  if (error) {
    console.error("[DocCy] dismiss pause notice", error);
    return NextResponse.json({ message: "Could not save. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
