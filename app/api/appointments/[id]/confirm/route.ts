import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { candidateOverlapsAnyBlockingInterval } from "@/lib/appointment-overlap";
import {
  fetchBlockingAppointments,
  toBlockingRows,
} from "@/lib/appointment-blocking-query";
import {
  isAllowedProfessionalDuration,
  PROFESSIONAL_DURATION_OPTIONS,
} from "@/lib/professional-appointment-durations";
import { sendPatientAppointmentConfirmedEmail } from "@/lib/send-patient-appointment-confirmed-email";

type RouteContext = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
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

  const durationMinutes = Number((body as { durationMinutes?: unknown }).durationMinutes);
  if (!isAllowedProfessionalDuration(durationMinutes)) {
    return NextResponse.json(
      {
        message: `Invalid durationMinutes. Allowed values (minutes): ${PROFESSIONAL_DURATION_OPTIONS.join(", ")}.`,
      },
      { status: 400 }
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
    .select("id, name, phone, specialty, clinic_address")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, patient_email, appointment_datetime, status, reason, duration_minutes"
    )
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.doctor_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const statusUpper = String(appt.status ?? "").toUpperCase();
  if (statusUpper !== "REQUESTED") {
    return NextResponse.json(
      { message: "Only pending requests can be confirmed." },
      { status: 400 }
    );
  }

  const { data: settings } = await supabase
    .from("doctor_settings")
    .select("slot_duration_minutes")
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  const fallbackDuration =
    (settings as { slot_duration_minutes?: number | null } | null)
      ?.slot_duration_minutes ?? 30;

  const { data: blockingRaw, error: othersErr } = await fetchBlockingAppointments(
    supabase,
    doctor.id
  );

  if (othersErr) {
    console.error(othersErr);
    return NextResponse.json(
      { message: "Error checking schedule." },
      { status: 500 }
    );
  }

  const hasConflict = candidateOverlapsAnyBlockingInterval(
    appt.appointment_datetime as string,
    durationMinutes,
    id,
    toBlockingRows(blockingRaw),
    fallbackDuration
  );

  if (hasConflict) {
    return NextResponse.json(
      { message: "This duration overlaps another appointment." },
      { status: 409 }
    );
  }

  const { error: updateErr } = await supabase
    .from("appointments")
    .update({
      status: "CONFIRMED",
      duration_minutes: durationMinutes,
    })
    .eq("id", id)
    .eq("doctor_id", doctor.id);

  if (updateErr) {
    console.error(updateErr);
    return NextResponse.json(
      { message: "Could not confirm appointment." },
      { status: 500 }
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const resendToOverride =
    process.env.NODE_ENV !== "production"
      ? process.env.RESEND_TO_OVERRIDE?.trim() || null
      : null;

  try {
    await sendPatientAppointmentConfirmedEmail({
      siteUrl,
      patientEmail: String(appt.patient_email),
      patientName: String(appt.patient_name),
      appointmentId: id,
      appointmentDatetimeIso: String(appt.appointment_datetime),
      durationMinutes,
      reason: (appt as { reason?: string | null }).reason ?? null,
      doctor: {
        name: doctor.name,
        specialty: (doctor as { specialty?: string | null }).specialty,
        phone: (doctor as { phone?: string | null }).phone,
        clinic_address: (doctor as { clinic_address?: string | null }).clinic_address,
      },
      resendToOverride,
    });
  } catch (e) {
    console.error("[DocCy] Patient confirmation email failed", e);
  }

  return NextResponse.json({
    message: "Appointment confirmed.",
    appointment: { id, status: "CONFIRMED", duration_minutes: durationMinutes },
  });
}
