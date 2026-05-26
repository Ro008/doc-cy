import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  APPOINTMENT_ATTENDANCE_NO_SHOW,
  parseAttendanceFromBody,
} from "@/lib/appointment-attendance";
import { isVisitSlotEnded } from "@/lib/appointments";

type RouteContext = { params: { id: string } };

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
      { message: "Invalid attendance. Allowed: no_show or null to clear." },
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
    .from("doctors")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select("id, doctor_id, status, appointment_datetime, duration_minutes")
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.doctor_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const statusUpper = String(appt.status ?? "").toUpperCase();
  if (statusUpper !== "CONFIRMED") {
    return NextResponse.json(
      { message: "Only confirmed visits can be marked for attendance." },
      { status: 400 },
    );
  }

  const durationMinutes =
    typeof appt.duration_minutes === "number" && appt.duration_minutes > 0
      ? appt.duration_minutes
      : 30;

  if (
    !isVisitSlotEnded(
      String(appt.appointment_datetime),
      durationMinutes,
    )
  ) {
    return NextResponse.json(
      { message: "Attendance can only be set after the visit time has passed." },
      { status: 400 },
    );
  }

  const { error: updateErr } = await supabase
    .from("appointments")
    .update({
      attendance: attendance === APPOINTMENT_ATTENDANCE_NO_SHOW ? attendance : null,
    })
    .eq("id", id)
    .eq("doctor_id", doctor.id);

  if (updateErr) {
    console.error("[DocCy] attendance update failed", updateErr);
    return NextResponse.json(
      { message: "Could not save attendance." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message:
      attendance === APPOINTMENT_ATTENDANCE_NO_SHOW
        ? "Marked as no-show."
        : "No-show marking removed.",
    attendance,
  });
}
