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
} from "@/lib/doctor-settings";
import {
  fetchBlockingAppointments,
  toBlockingRows,
} from "@/lib/appointment-blocking-query";
import { candidateOverlapsAnyBlockingInterval } from "@/lib/appointment-overlap";
import { parseBookingPatientFields } from "@/lib/booking-patient-fields";
import { manualBookingPermission } from "@/lib/booking-permission";
import { issuePatientCancelLink } from "@/lib/appointment-links-db";
import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";
import { sendPatientAppointmentConfirmedEmail } from "@/lib/send-patient-appointment-confirmed-email";
import { loadPrimarySpecialtyName } from "@/lib/specialty-catalogue";
import { getDoctorCalendarEventDetails } from "@/lib/doctor-calendar-event";
import { buildGoogleCalendarUrl } from "@/lib/patient-calendar-event";
import { appointmentClinicCopy, loadAppointmentClinicPhone } from "@/lib/appointment-clinic-copy";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";
import { locationHasClinic } from "@/lib/professional-clinic-locations";
import { locationToSettingsRow } from "@/lib/doctor-locations";
import { PROFESSIONAL_ACCOUNT_SETTINGS_SELECT } from "@/lib/professional-account-settings";
import { appointmentCalendarPath } from "@/lib/appointment-links";

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

  const { appointmentLocal, locationId: rawLocationId } = body as {
    appointmentLocal?: string;
    locationId?: string;
  };
  if (!appointmentLocal) {
    return NextResponse.json({ message: "Appointment date/time is required." }, { status: 400 });
  }

  // Same details as an online booking; only the email is optional (user, 2026-10-02).
  const parsed = parseBookingPatientFields(body as Record<string, unknown>, "manual");
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });
  const { patientName, patientPhone, reason } = parsed.fields;
  const patientEmail = parsed.fields.patientEmail ?? "";

  const { data: doctor, error: doctorErr } = await supabase
    .from("professionals")
    .select("id, name, slug, is_registered, pro_access_until")
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
    .from("professional_settings")
    .select(PROFESSIONAL_ACCOUNT_SETTINGS_SELECT)
    .eq("professional_id", doctor.id)
    .single();

  if (settingsError || !settings) {
    return NextResponse.json(
      { message: "Professional has not set availability yet." },
      { status: 400 },
    );
  }

  const locations = await loadDoctorLocations(doctor.id);
  const requestedLocationId = String(rawLocationId ?? "").trim();
  let bookingLocation = requestedLocationId
    ? locations.find((row) => row.id === requestedLocationId) ?? null
    : primaryDoctorLocation(locations);
  if (locations.length > 1) {
    if (!requestedLocationId) {
      return NextResponse.json(
        { message: "Please choose a clinic for this appointment." },
        { status: 400 },
      );
    }
    bookingLocation =
      locations.find((row) => row.id === requestedLocationId) ?? null;
    if (!bookingLocation) {
      return NextResponse.json({ message: "Clinic not found." }, { status: 400 });
    }
  }

  // Every appointment is at a clinic with an address (user, 2026-09-29).
  if (!bookingLocation || !locationHasClinic(bookingLocation) || !bookingLocation.clinic_id) {
    return NextResponse.json(
      { message: "This clinic is not set up yet. Contact us to set it up before booking." },
      { status: 400 },
    );
  }

  // Pausing doesn't block manual bookings; expired access does (user, 2026-10-02).
  const permission = manualBookingPermission({
    isRegistered: Boolean((doctor as { is_registered?: boolean }).is_registered),
    proAccessUntil: (doctor as { pro_access_until?: string | null }).pro_access_until ?? null,
    clinicPaused: Boolean(bookingLocation.pause_online_bookings),
    clinicArchived: false,
  });
  if (!permission.allowed) {
    return NextResponse.json(
      {
        message:
          permission.reason === "access_expired"
            ? "Your DocCy access has ended, so you can't add new bookings."
            : "You can't add bookings at this clinic.",
        code: permission.reason,
      },
      { status: 403 },
    );
  }

  // The schedule is the clinic link's; holiday, horizon and notice are the account's.
  const settingsRow = locationToSettingsRow(bookingLocation, settings);
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
      professional_id: doctor.id,
      clinic_id: bookingLocation.clinic_id,
      // Until M2 drops it, the clinic link id is still written for the running readers.
      location_id: bookingLocation.id,
      booking_source: "manual",
      patient_name: patientName,
      patient_email: patientEmail || null,
      patient_phone: patientPhone,
      patient_gender: parsed.fields.patientGender,
      patient_birthdate: parsed.fields.patientBirthdate,
      is_new_patient: parsed.fields.isNewPatient,
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

  const clinic = appointmentClinicCopy({
    locations,
    locationId: bookingLocation?.id ?? null,
  });

  const specialtyName = await loadPrimarySpecialtyName(supabase, doctor.id as string);

  try {
    if (patientEmail && !isUndeliverableTestEmail(patientEmail)) {
      // Manual-booking patients with an email get the cancel link too (user, 2026-10-04).
      const cancel = await issuePatientCancelLink(
        supabase,
        {
          id: String(inserted.id),
          professional_id: String(doctor.id),
          appointment_datetime: String(inserted.appointment_datetime),
        },
        siteUrl,
      ).catch((err) => {
        console.error("[DocCy] manual booking cancel link", err);
        return null;
      });
      await sendPatientAppointmentConfirmedEmail({
        cancel,
        siteUrl,
        patientEmail,
        patientName,
        appointmentId: String(inserted.id),
        appointmentDatetimeIso: String(inserted.appointment_datetime),
        durationMinutes: slotDuration,
        reason,
        doctor: {
          name: doctor.name,
          specialty: specialtyName,
          phone: await loadAppointmentClinicPhone(supabase, clinic.locationId),
          clinic_address: clinic.address,
        },
        clinic,
        resendToOverride,
      });
    }
  } catch (err) {
    console.error("[DocCy] Patient manual booking email failed", err);
  }

  // No email to the professional about a booking she entered herself (user, 2026-10-02).

  const startUtc = new Date(String(inserted.appointment_datetime));
  const endUtc = addMinutes(startUtc, slotDuration);
  const calendarDetails = getDoctorCalendarEventDetails(
    { patient_name: patientName, patient_phone: patientPhone || null },
    { name: doctor.name, clinic_address: clinic.address },
    { reason },
  );
  const googleCalendarUrl = buildGoogleCalendarUrl({
    title: calendarDetails.title,
    description: calendarDetails.description,
    location: calendarDetails.location,
    startUtc,
    endUtc,
  });
  const iCalUrl = appointmentCalendarPath(String(inserted.id), "professional") ?? "";
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

