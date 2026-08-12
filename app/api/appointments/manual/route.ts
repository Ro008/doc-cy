import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";
import { addDays, addHours, addMinutes, format } from "date-fns";
import { CY_TZ } from "@/lib/appointments";
import {
  buildWeeklyScheduleFromSettings,
  isDateInHolidayRange,
  isTimeWithinSettings,
  normalizeMinimumNoticeHours,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import {
  fetchBlockingAppointments,
  toBlockingRows,
} from "@/lib/appointment-blocking-query";
import { candidateOverlapsAnyBlockingInterval } from "@/lib/appointment-overlap";
import { normalizeAppointmentReason } from "@/lib/visit-types";
import { sendPatientAppointmentConfirmedEmail } from "@/lib/send-patient-appointment-confirmed-email";
import { sendDoctorAppointmentConfirmedEmail } from "@/lib/send-doctor-appointment-confirmed-email";
import { getDoctorCalendarEventDetails } from "@/lib/doctor-calendar-event";
import { buildGoogleCalendarUrl } from "@/lib/patient-calendar-event";

export async function POST(req: NextRequest) {
  const authSupabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Server misconfiguration." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const {
    patientName: rawPatientName,
    patientEmail: rawPatientEmail,
    patientPhone: rawPatientPhone,
    appointmentLocal,
    reason: rawReason,
  } = body as {
    patientName?: string;
    patientEmail?: string;
    patientPhone?: string;
    appointmentLocal?: string;
    reason?: string;
  };

  const patientName = String(rawPatientName ?? "").trim();
  const patientEmail = String(rawPatientEmail ?? "").trim();
  const patientPhone = String(rawPatientPhone ?? "").trim();
  const patientPhoneStored = patientPhone || "Not provided";
  if (!patientName || !appointmentLocal) {
    return NextResponse.json(
      { message: "Patient name and appointment date/time are required." },
      { status: 400 },
    );
  }

  const reason = normalizeAppointmentReason(rawReason);
  if (!reason) {
    return NextResponse.json(
      { message: "Please tell us briefly why you need this visit." },
      { status: 400 },
    );
  }

  const { data: doctor, error: doctorErr } = await supabase
    .from("doctors")
    .select("id, name, email, phone, slug, specialty, clinic_address")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  let appointmentUtc: Date;
  try {
    appointmentUtc = zonedTimeToUtc(appointmentLocal, CY_TZ);
  } catch {
    return NextResponse.json({ message: "Invalid appointmentLocal value." }, { status: 400 });
  }
  if (Number.isNaN(appointmentUtc.getTime())) {
    return NextResponse.json({ message: "Invalid appointmentLocal value." }, { status: 400 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from("doctor_settings")
    .select("*")
    .eq("doctor_id", doctor.id)
    .single();

  if (settingsError || !settings) {
    return NextResponse.json(
      { message: "Professional has not set availability yet." },
      { status: 400 },
    );
  }

  const settingsRow = settings as DoctorSettingsRow;
  const cyLocal = utcToZonedTime(appointmentUtc, CY_TZ);
  const dayOfWeek = cyLocal.getDay();
  const hours = cyLocal.getHours();
  const minutes = cyLocal.getMinutes();
  const hhmmss = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  const appointmentDateKey = format(cyLocal, "yyyy-MM-dd");

  if (isDateInHolidayRange(settingsRow, appointmentDateKey)) {
    return NextResponse.json({ message: "Bookings temporarily unavailable" }, { status: 403 });
  }

  const horizonDays = Number(settingsRow.booking_horizon_days ?? 90);
  const maxHorizonDays = [14, 30, 90, 180].includes(horizonDays) ? horizonDays : 90;
  const todayCyprus = utcToZonedTime(new Date(), CY_TZ);
  const maxDateKey = format(addDays(todayCyprus, maxHorizonDays), "yyyy-MM-dd");
  if (appointmentDateKey > maxDateKey) {
    return NextResponse.json(
      { message: "Requested time is outside your booking horizon." },
      { status: 400 },
    );
  }

  const minimumNoticeHours = normalizeMinimumNoticeHours(
    settingsRow.minimum_notice_hours,
  );
  const minimumNoticeCutoffUtc = addHours(new Date(), minimumNoticeHours);
  if (appointmentUtc.getTime() < minimumNoticeCutoffUtc.getTime()) {
    return NextResponse.json(
      { message: "Requested time does not meet your minimum notice period." },
      { status: 400 },
    );
  }

  if (!isTimeWithinSettings(settingsRow, dayOfWeek, hhmmss)) {
    return NextResponse.json(
      { message: "Requested time is outside your published availability." },
      { status: 400 },
    );
  }

  const slotDurationMinutes = Number(settingsRow.slot_duration_minutes ?? 30);
  const slotDuration =
    Number.isFinite(slotDurationMinutes) && slotDurationMinutes > 0
      ? slotDurationMinutes
      : 30;
  const weeklySchedule = buildWeeklyScheduleFromSettings(settingsRow);
  const dayKeyByDow = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  const dayStartRaw = weeklySchedule[dayKeyByDow[dayOfWeek]]?.start_time ?? "09:00:00";
  const [dayStartHour, dayStartMinute] = dayStartRaw.split(":").map(Number);
  const dayStartMinutesFromMidnight = dayStartHour * 60 + dayStartMinute;
  const requestedMinutesFromMidnight = hours * 60 + minutes;
  const minutesSinceDayStart = requestedMinutesFromMidnight - dayStartMinutesFromMidnight;
  if (minutesSinceDayStart % slotDuration !== 0) {
    return NextResponse.json(
      { message: "Requested time is not aligned with your slot duration." },
      { status: 400 },
    );
  }

  const { data: blockingRaw, error: existingError } = await fetchBlockingAppointments(
    supabase,
    doctor.id,
  );
  if (existingError) {
    return NextResponse.json(
      { message: "Error checking existing appointments." },
      { status: 500 },
    );
  }

  const taken = candidateOverlapsAnyBlockingInterval(
    appointmentUtc.toISOString(),
    slotDuration,
    null,
    toBlockingRows(blockingRaw),
    slotDuration,
  );
  if (taken) {
    return NextResponse.json({ message: "Slot already taken." }, { status: 409 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert({
      doctor_id: doctor.id,
      patient_name: patientName,
      patient_email: patientEmail || null,
      patient_phone: patientPhoneStored,
      appointment_datetime: appointmentUtc.toISOString(),
      status: "CONFIRMED",
      reason,
      duration_minutes: slotDuration,
      created_at: new Date().toISOString(),
    })
    .select("id, appointment_datetime, status, duration_minutes")
    .single();

  if (insertError) {
    console.error("[DocCy] Manual booking insert failed", insertError);
    const code = (insertError as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ message: "Slot already taken." }, { status: 409 });
    }
    return NextResponse.json(
      { message: "Error creating appointment." },
      { status: 500 },
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const resendToOverride =
    process.env.NODE_ENV !== "production"
      ? process.env.RESEND_TO_OVERRIDE?.trim() || null
      : null;

  try {
    if (patientEmail) {
      await sendPatientAppointmentConfirmedEmail({
        siteUrl,
        patientEmail,
        patientName,
        appointmentId: String(inserted.id),
        appointmentDatetimeIso: String(inserted.appointment_datetime),
        durationMinutes: slotDuration,
        reason,
        doctor: {
          name: doctor.name,
          specialty: (doctor as { specialty?: string | null }).specialty,
          phone: (doctor as { phone?: string | null }).phone,
          clinic_address: (doctor as { clinic_address?: string | null }).clinic_address,
        },
        resendToOverride,
      });
    }
  } catch (err) {
    console.error("[DocCy] Patient manual booking email failed", err);
  }

  try {
    await sendDoctorAppointmentConfirmedEmail({
      siteUrl,
      doctorEmail: String((doctor as { email?: string | null }).email ?? ""),
      doctorName: String(doctor.name ?? "Doctor"),
      appointmentId: String(inserted.id),
      appointmentDatetimeIso: String(inserted.appointment_datetime),
      durationMinutes: slotDuration,
      patientName,
      patientPhone: patientPhoneStored,
      reason,
      resendToOverride,
      manualCreated: true,
    });
  } catch (err) {
    console.error("[DocCy] Doctor manual booking email failed", err);
  }

  const startUtc = new Date(String(inserted.appointment_datetime));
  const endUtc = addMinutes(startUtc, slotDuration);
  const calendarDetails = getDoctorCalendarEventDetails(
    { patient_name: patientName, patient_phone: patientPhone || null },
    { name: doctor.name },
    { reason },
  );
  const googleCalendarUrl = buildGoogleCalendarUrl({
    title: calendarDetails.title,
    description: calendarDetails.description,
    location: calendarDetails.location,
    startUtc,
    endUtc,
  });
  const iCalUrl = `/api/appointments/${encodeURIComponent(String(inserted.id))}/calendar?audience=doctor`;
  const profileUrl = doctor.slug
    ? new URL(`/${doctor.slug}`, siteUrl).toString()
    : null;

  return NextResponse.json(
    {
      message: "Manual booking confirmed.",
      appointment: inserted,
      links: {
        googleCalendarUrl,
        iCalUrl,
        profileUrl,
      },
    },
    { status: 201 },
  );
}

