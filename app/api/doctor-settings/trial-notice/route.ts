import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { isDoctorVerifiedForProduct } from "@/lib/doctor-account-access";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Persist that the verified professional dismissed the first-login trial notice.
 * Authz via the user session; write via service role so RLS cannot silently no-op.
 */
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
      // Column missing on this env — do not pretend dismiss succeeded.
      return NextResponse.json(
        { message: "Trial notice is not available on this environment yet." },
        { status: 503 },
      );
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

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json(
      { message: "Server is not configured to save trial notice." },
      { status: 503 },
    );
  }

  const seenAt = new Date().toISOString();
  const update = await service
    .from("professionals")
    .update({ trial_notice_seen_at: seenAt })
    .eq("auth_user_id", user.id)
    .eq("id", doctorRes.data.id)
    .select("trial_notice_seen_at")
    .maybeSingle();

  if (update.error) {
    console.error("[DocCy] Failed to save trial notice", update.error);
    return NextResponse.json({ message: "Error saving trial notice." }, { status: 500 });
  }

  if (!String(update.data?.trial_notice_seen_at ?? "").trim()) {
    console.error("[DocCy] Trial notice update matched no row", {
      doctorId: doctorRes.data.id,
      authUserId: user.id,
    });
    return NextResponse.json({ message: "Error saving trial notice." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, trialNoticeSeenAt: seenAt }, { status: 200 });
}
