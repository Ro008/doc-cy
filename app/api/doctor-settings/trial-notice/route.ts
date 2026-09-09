import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { isDoctorVerifiedForProduct } from "@/lib/doctor-account-access";

/** Persist that the verified professional dismissed the first-login trial notice. */
export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const doctorRes = await supabase
    .from("professionals")
    .select("id, status, trial_notice_seen_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorRes.error) {
    const msg = String(doctorRes.error.message ?? "");
    if (doctorRes.error.code === "42703" || /trial_notice_seen_at/i.test(msg)) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    return NextResponse.json({ message: "Error fetching professional." }, { status: 500 });
  }

  if (!doctorRes.data) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  if (!isDoctorVerifiedForProduct(doctorRes.data.status)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  if (String(doctorRes.data.trial_notice_seen_at ?? "").trim()) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const seenAt = new Date().toISOString();
  const update = await supabase
    .from("professionals")
    .update({ trial_notice_seen_at: seenAt })
    .eq("auth_user_id", user.id)
    .eq("id", doctorRes.data.id);

  if (update.error) {
    console.error("[DocCy] Failed to save trial notice", update.error);
    return NextResponse.json({ message: "Error saving trial notice." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, trialNoticeSeenAt: seenAt }, { status: 200 });
}
