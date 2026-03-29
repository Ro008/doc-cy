// app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { CY_TZ } from "@/lib/appointments";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";
import { addDays, addHours, addMinutes, format } from "date-fns";
import { candidateOverlapsAnyBlockingInterval } from "@/lib/appointment-overlap";
import {
  fetchBlockingAppointments,
  toBlockingRows,
} from "@/lib/appointment-blocking-query";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  buildWeeklyScheduleFromSettings,
  isDateInHolidayRange,
  isTimeWithinSettings,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import type { DoctorRow } from "@/lib/doctors";
import {
  normalizeAppointmentReason,
} from "@/lib/visit-types";
import { professionalFirstName } from "@/lib/professional-name";

const PRIMARY_ACTIONS_LABEL =
  "margin:18px 0 10px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;";
const DASHBOARD_LINK_STYLE =
  "display:block;text-align:center;background:#34d399;color:#022c22;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;margin:0 0 10px;font-size:15px;";

export async function POST(req: NextRequest) {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      {
        message:
          "Server is not configured for booking (missing SUPABASE_SERVICE_ROLE_KEY).",
      },
      { status: 503 }
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";

  const {
    doctorId: rawDoctorId,
    doctorSlug,
    patientName,
    patientEmail,
    patientPhone,
    appointmentLocal,
    reason: rawReason,
  } = body as {
    doctorId?: string;
    doctorSlug?: string;
    patientName?: string;
    patientEmail?: string;
    patientPhone?: string;
    appointmentLocal?: string; // "YYYY-MM-DDTHH:mm" in Europe/Nicosia
    reason?: string;
  };

  let doctorId = rawDoctorId;

  // Allow tests/clients to pass doctorSlug instead of doctorId (MVP convenience)
  if (!doctorId && doctorSlug) {
    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select("id")
      .eq("slug", doctorSlug)
      .single();

    if (doctorError || !doctor) {
      return NextResponse.json(
        { message: "Professional not found for provided slug." },
        { status: 400 }
      );
    }
    doctorId = doctor.id as string;
  }

  if (
    !doctorId ||
    !patientName ||
    !patientEmail ||
    !patientPhone ||
    !appointmentLocal
  ) {
    return NextResponse.json(
      { message: "Missing required fields." },
      { status: 400 }
    );
  }

  const reason = normalizeAppointmentReason(rawReason);
  if (!reason) {
    return NextResponse.json(
      { message: "Please tell us briefly why you need this visit." },
      { status: 400 }
    );
  }

  const { data: doctorGate, error: doctorGateError } = await supabase
    .from("doctors")
    .select("id, status")
    .eq("id", doctorId)
    .single();

  if (doctorGateError || !doctorGate) {
    return NextResponse.json({ message: "Professional not found." }, { status: 400 });
  }
  if ((doctorGate as { status?: string }).status !== "verified") {
    return NextResponse.json(
      { message: "This professional is not accepting public bookings yet." },
      { status: 403 }
    );
  }

  // Interpret appointmentLocal as local Europe/Nicosia time and convert to UTC
  let appointmentUtc: Date;
  try {
    appointmentUtc = zonedTimeToUtc(appointmentLocal, CY_TZ);
  } catch {
    return NextResponse.json(
      { message: "Invalid appointmentLocal value." },
      { status: 400 }
    );
  }

  if (Number.isNaN(appointmentUtc.getTime())) {
    return NextResponse.json(
      { message: "Invalid appointmentLocal value." },
      { status: 400 }
    );
  }

  // Verify requested time against doctor_settings (working days + hours)
  const cyLocal = utcToZonedTime(appointmentUtc, CY_TZ);
  const dayOfWeek = cyLocal.getDay(); // 0-6
  const hours = cyLocal.getHours();
  const minutes = cyLocal.getMinutes();
  const hhmmss = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:00`;

  const { data: settings, error: settingsError } = await supabase
    .from("doctor_settings")
    .select("*")
    .eq("doctor_id", doctorId)
    .single();

  if (settingsError || !settings) {
    if ((settingsError as { code?: string })?.code === "PGRST116") {
      return NextResponse.json(
        { message: "Professional has not set availability yet." },
        { status: 400 }
      );
    }
    console.error(settingsError);
    return NextResponse.json(
      { message: "Error checking availability." },
      { status: 500 }
    );
  }

  const pauseOnlineBookings = Boolean(
    (settings as DoctorSettingsRow).pause_online_bookings
  );
  if (pauseOnlineBookings) {
    return NextResponse.json(
      { message: "Bookings temporarily unavailable" },
      { status: 403 }
    );
  }

  const appointmentDateKey = format(cyLocal, "yyyy-MM-dd");
  if (isDateInHolidayRange(settings as DoctorSettingsRow, appointmentDateKey)) {
    return NextResponse.json(
      { message: "Bookings temporarily unavailable" },
      { status: 403 }
    );
  }

  const horizonDays = Number(
    (settings as DoctorSettingsRow).booking_horizon_days ?? 90
  );
  const maxHorizonDays = [14, 30, 90, 180].includes(horizonDays)
    ? horizonDays
    : 90;
  const todayCyprus = utcToZonedTime(new Date(), CY_TZ);
  const maxDateKey = format(addDays(todayCyprus, maxHorizonDays), "yyyy-MM-dd");
  if (appointmentDateKey > maxDateKey) {
    return NextResponse.json(
      { message: "Requested time is outside the professional's booking horizon." },
      { status: 400 }
    );
  }

  const noticeHours = Number(
    (settings as DoctorSettingsRow).minimum_notice_hours ?? 2
  );
  const minimumNoticeHours = [1, 2, 12, 24].includes(noticeHours)
    ? noticeHours
    : 2;
  const minimumNoticeCutoffUtc = addHours(new Date(), minimumNoticeHours);
  if (appointmentUtc.getTime() < minimumNoticeCutoffUtc.getTime()) {
    return NextResponse.json(
      { message: "Requested time does not meet the minimum notice period." },
      { status: 400 }
    );
  }

  const withinSlot = isTimeWithinSettings(
    settings as DoctorSettingsRow,
    dayOfWeek,
    hhmmss
  );

  if (!withinSlot) {
    return NextResponse.json(
      { message: "Requested time is outside the professional's availability." },
      { status: 400 }
    );
  }

  const settingsRow = settings as DoctorSettingsRow;
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
  const dayKey = dayKeyByDow[dayOfWeek];
  const dayStartRaw = weeklySchedule[dayKey]?.start_time ?? "09:00:00";
  const [dayStartHour, dayStartMinute] = dayStartRaw.split(":").map(Number);
  const dayStartMinutesFromMidnight = dayStartHour * 60 + dayStartMinute;
  const requestedMinutesFromMidnight = hours * 60 + minutes;

  // Enforce slot grid alignment server-side (protects against malformed clients/tests).
  const minutesSinceDayStart =
    requestedMinutesFromMidnight - dayStartMinutesFromMidnight;
  if (minutesSinceDayStart % slotDuration !== 0) {
    return NextResponse.json(
      { message: "Requested time is not aligned with the professional's slot duration." },
      { status: 400 }
    );
  }

  const requestedStartIso = appointmentUtc.toISOString();
  const { data: blockingRaw, error: existingError } = await fetchBlockingAppointments(
    supabase,
    doctorId
  );

  if (existingError) {
    console.error(existingError);
    return NextResponse.json(
      { message: "Error checking existing appointments." },
      { status: 500 }
    );
  }

  const taken = candidateOverlapsAnyBlockingInterval(
    requestedStartIso,
    slotDuration,
    null,
    toBlockingRows(blockingRaw),
    slotDuration
  );

  if (taken) {
    return NextResponse.json({ message: "Slot already taken." }, { status: 409 });
  }

  // Initial duration for overlap checks and agenda height uses doctor_settings.slot_duration_minutes
  // (defaults to 30). This is provisional until the professional confirms and adjusts the slot.
  const bookedAtIso = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert({
      doctor_id: doctorId,
      patient_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
      appointment_datetime: appointmentUtc.toISOString(),
      status: "REQUESTED",
      reason,
      duration_minutes: slotDuration,
      // Exact moment the patient submitted the request (dashboard KPIs)
      created_at: bookedAtIso,
    })
    .select("id, appointment_datetime, status, created_at, reason")
    .single();

  if (insertError) {
    console.error(insertError);

    // Handle potential race condition via unique constraint
    const code = (insertError as any)?.code;
    if (code === "23505") {
      return NextResponse.json(
        { message: "Slot already taken." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "Error creating appointment." },
      { status: 500 }
    );
  }

  // Notifications (best-effort) via Resend. From: DocCy <no-reply@mydoccy.com> (override RESEND_FROM for dev).
  // No reply_to. Do not block booking success if notifications fail.
  try {
    const { data: doctor } = await supabase
      .from("doctors")
      .select("name, email, phone, specialty, clinic_address")
      .eq("id", doctorId)
      .single();

    const doctorRow = doctor as DoctorRow | null;
    const doctorName = doctorRow?.name ?? undefined;
    const doctorEmail = (doctorRow?.email ?? "").trim();
    const patientEmailTo = String(patientEmail).trim();
    const resendToOverride = process.env.RESEND_TO_OVERRIDE?.trim();
    const allowRecipientOverride = process.env.NODE_ENV !== "production";
    const effectiveOverride =
      allowRecipientOverride && resendToOverride ? resendToOverride : null;

    const cyDate = appointmentToCyprusDate(inserted.appointment_datetime as string);
    const dateLabel = format(cyDate, "EEEE, d MMMM yyyy", { locale: enUS });
    const timeLabel = format(cyDate, "HH:mm");
    const manageUrl = new URL(
      `/dashboard/appointments/${encodeURIComponent(String(inserted.id))}`,
      siteUrl
    ).toString();

    if (doctorName) {
      const proFirst = professionalFirstName(doctorName);

      const doctorText =
        `Hi ${proFirst},\n\n` +
        `You have a new appointment request from ${patientName} for ${dateLabel} at ${timeLabel} (Cyprus time).\n\n` +
        `Reason: ${reason}\n\n` +
        `Please sign in to DocCy to review, adjust the duration, and confirm.\n\n` +
        `${manageUrl}\n\n` +
        `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

      const doctorHtml = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">New appointment request</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">Hi ${escapeHtml(proFirst)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      You have a new request from <strong>${escapeHtml(patientName)}</strong> for
      <strong>${escapeHtml(dateLabel)}</strong> at <strong>${escapeHtml(timeLabel)}</strong> (Cyprus time).
    </p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      Please sign in to DocCy to review, adjust the duration, and confirm.
    </p>

    <p style="${PRIMARY_ACTIONS_LABEL}">Next step</p>
    <a href="${manageUrl}" style="${DASHBOARD_LINK_STYLE}">Open request in DocCy</a>

    ${automatedEmailFooterHtml()}
  </div>
</div>`;

      const doctorRecipient = effectiveOverride || doctorEmail;
      if (doctorRecipient) {
        await sendResendEmail({
          to: doctorRecipient,
          subject: `🩺 New appointment request: ${patientName}`,
          text: doctorText,
          html: doctorHtml,
        });
      } else {
        console.warn(
          "[DocCy] Professional notification skipped: missing email and no RESEND_TO_OVERRIDE."
        );
      }

      const patientText =
        `Hi ${patientName},\n\n` +
        `We've sent your appointment request to ${doctorName}. They will review the reason for your visit to assign the time you need.\n\n` +
        `We'll let you know as soon as it is confirmed. Please do not add this visit to your external calendar yet.\n\n` +
        `Please manage this request through DocCy — wait for our email rather than contacting the clinic directly to schedule.\n\n` +
        `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

      const patientHtml = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">Request sent</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">Hi ${escapeHtml(patientName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      We've sent your request to <strong>${escapeHtml(doctorName)}</strong>. They will review the reason for your visit to assign the time you need.
    </p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      We'll let you know as soon as it is confirmed. Please <strong>do not</strong> add this visit to your external calendar yet.
    </p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#94a3b8;">
      Please wait for DocCy to confirm your visit rather than messaging the clinic separately to book the same time.
    </p>

    ${automatedEmailFooterHtml()}
  </div>
</div>`;

      const patientRecipient = effectiveOverride || patientEmailTo;
      if (patientRecipient) {
        await sendResendEmail({
          to: patientRecipient,
          subject: `Request sent — awaiting confirmation with ${doctorName}`,
          text: patientText,
          html: patientHtml,
        });
      } else {
        console.warn(
          "[DocCy] Patient notification skipped: missing patient email and no RESEND_TO_OVERRIDE."
        );
      }
    }
  } catch (err) {
    console.error("[DocCy] Failed to send appointment notification emails", err);
  }

  return NextResponse.json(
    {
      appointment: inserted,
      message: "Your booking request was submitted.",
    },
    { status: 201 }
  );
}

