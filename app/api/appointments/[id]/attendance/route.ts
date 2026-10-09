import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  APPOINTMENT_ATTENDANCE_NO_SHOW,
  attendanceChangeRefusal,
  parseAttendanceFromBody,
} from "@/lib/appointment-attendance";
import { createServiceRoleClient } from "@/lib/supabase-service";

type RouteContext = { params: { id: string } };

/**
 * She switches a past confirmed visit between attended and no-show (user, 2026-10-04),
 * until the review email has gone out. The scheduled job sets `attended` on its own.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ message: "Missing appointment id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const attendance = parseAttendanceFromBody(
    (body as { attendance?: unknown }).attendance,
  );
  if (attendance === "invalid") {
    return NextResponse.json(
      { message: "Invalid attendance. Allowed: attended or no_show." },
      { status: 400 },
    );
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { data: doctor, error: doctorErr } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
  }

  const { data: appt, error: apptErr } = await service
    .from("appointments")
    .select("id, professional_id, status, appointment_datetime, duration_minutes, review_requested_at")
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.professional_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const refusal = attendanceChangeRefusal({
    status: appt.status as string | null,
    appointmentIso: String(appt.appointment_datetime),
    durationMinutes: appt.duration_minutes as number | null,
    reviewRequestedAt: appt.review_requested_at as string | null,
    now: new Date(),
  });
  if (refusal) {
    return NextResponse.json(
      { message: refusal.message, code: refusal.code },
      { status: refusal.code === "review_sent" ? 409 : 400 },
    );
  }

  // Guarded: still confirmed and the review email not sent in the meantime.
  const { data: updated, error: updateErr } = await service
    .from("appointments")
    .update({ attendance })
    .eq("id", id)
    .eq("professional_id", doctor.id)
    .eq("status", "CONFIRMED")
    .is("review_requested_at", null)
    .select("id");

  if (updateErr) {
    console.error("[DocCy] attendance update failed", updateErr);
    return NextResponse.json(
      { message: "Could not save attendance." },
      { status: 500 },
    );
  }
  if (!updated?.length) {
    return NextResponse.json(
      { message: "This visit changed in the meantime. Please reload.", code: "conflict" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    message:
      attendance === APPOINTMENT_ATTENDANCE_NO_SHOW
        ? "Marked as no-show."
        : "Marked as attended.",
    attendance,
  });
}
