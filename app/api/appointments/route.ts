// app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { CY_TZ } from "@/lib/appointments";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";
import { addMinutes, format } from "date-fns";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
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
import { phoneToWaMeLink } from "@/lib/whatsapp";
import { getDoctorCalendarEventDetails } from "@/lib/doctor-calendar-event";
import {
  buildGoogleCalendarUrl,
  getCalendarEventDetails,
} from "@/lib/patient-calendar-event";
import { normalizeVisitNotes, parseVisitType } from "@/lib/visit-types";

const WHATSAPP_CTA_STYLE =
  "display:block;text-align:center;background:#25D366;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 16px;border-radius:12px;margin:0 0 12px;font-size:15px;";
const CAL_GOOGLE_STYLE =
  "display:block;text-align:center;background:#34d399;color:#022c22;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;margin:0 0 10px;font-size:15px;";
const CAL_ICS_STYLE =
  "display:block;text-align:center;background:rgba(52,211,153,.14);color:#a7f3d0;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;border:1px solid rgba(52,211,153,.35);font-size:15px;";
const PRIMARY_ACTIONS_LABEL =
  "margin:18px 0 10px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;";

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
    visitType: rawVisitType,
    visitNotes: rawVisitNotes,
  } = body as {
    doctorId?: string;
    doctorSlug?: string;
    patientName?: string;
    patientEmail?: string;
    patientPhone?: string;
    appointmentLocal?: string; // "YYYY-MM-DDTHH:mm" in Europe/Nicosia
    visitType?: string;
    visitNotes?: string;
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

  const visitType = parseVisitType(rawVisitType);
  if (!visitType) {
    return NextResponse.json(
      { message: "Please select a valid type of visit." },
      { status: 400 }
    );
  }
  const visitNotes = normalizeVisitNotes(rawVisitNotes);

  const visitForCal = { visitType, visitNotes };

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

  // Check if there is already an appointment at exactly this time for this doctor
  const { data: existing, error: existingError } = await supabase
    .from("appointments")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("appointment_datetime", appointmentUtc.toISOString())
    .limit(1);

  if (existingError) {
    console.error(existingError);
    return NextResponse.json(
      { message: "Error checking existing appointments." },
      { status: 500 }
    );
  }

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { message: "Slot already taken." },
      { status: 409 }
    );
  }

  // Insert appointment with status 'confirmed' (MVP: auto-confirm)
  const bookedAtIso = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert({
      doctor_id: doctorId,
      patient_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
      appointment_datetime: appointmentUtc.toISOString(),
      status: "confirmed",
      visit_type: visitType,
      visit_notes: visitNotes,
      // Exact moment the patient completed "Book appointment" (for dashboard month / activity)
      created_at: bookedAtIso,
    })
    .select("id, appointment_datetime, status, created_at")
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
    const doctorWaMe = phoneToWaMeLink(doctorRow?.phone);
    const patientWaMe = phoneToWaMeLink(patientPhone);

    const cyDate = appointmentToCyprusDate(inserted.appointment_datetime as string);
    const compactWhenLabel = format(cyDate, "EEE d MMM, HH:mm");

    if (doctorName) {
      const demoTo = "rociosirvent@gmail.com";

      let patientText = `Hi ${patientName},\n\nYour appointment with ${doctorName} is confirmed for ${compactWhenLabel} (Cyprus time).`;
      patientText += `\n\nVisit type: ${visitType}`;
      if (visitNotes) {
        patientText += `\nNotes: ${visitNotes}`;
      }
      if (doctorWaMe) {
        patientText += `\n\nChat with ${doctorName} on WhatsApp: ${doctorWaMe}`;
      }

      let doctorText = `New appointment\n\nVisit type: ${visitType}`;
      if (visitNotes) {
        doctorText += `\nNotes: ${visitNotes}`;
      }
      doctorText += `\n\nPatient: ${patientName}\nPatient email: ${patientEmail}\nWhen: ${compactWhenLabel} (Cyprus time)`;
      if (patientWaMe || patientPhone) {
        doctorText += `\n\n💬 Chat on WhatsApp (${patientPhone}): ${patientWaMe ?? "N/A"}`;
      }

      const durationMinutes =
        (settings as DoctorSettingsRow | null)?.slot_duration_minutes ?? 30;

      const startUtc = new Date(inserted.appointment_datetime as string);
      const endUtc = addMinutes(startUtc, durationMinutes);

      const patientCal = getCalendarEventDetails(
        {
          id: inserted.id as string,
          appointment_datetime: inserted.appointment_datetime as string,
        },
        {
          name: doctorRow?.name,
          specialty: doctorRow?.specialty,
          phone: doctorRow?.phone,
          clinic_address: doctorRow?.clinic_address,
        },
        visitForCal
      );

      const doctorCal = getDoctorCalendarEventDetails(
        {
          patient_name: patientName,
          patient_email: patientEmail,
          patient_phone: patientPhone,
        },
        {
          name: doctorRow?.name,
          specialty: doctorRow?.specialty,
          phone: doctorRow?.phone,
          clinic_address: doctorRow?.clinic_address,
        },
        visitForCal
      );

      const patientGoogleUrl = buildGoogleCalendarUrl({
        title: patientCal.title,
        description: patientCal.description,
        location: patientCal.location,
        startUtc,
        endUtc,
      });

      const doctorGoogleUrl = buildGoogleCalendarUrl({
        title: doctorCal.title,
        description: doctorCal.description,
        location: doctorCal.location,
        startUtc,
        endUtc,
      });

      const patientIcsUrl = new URL(
        `/api/appointments/${encodeURIComponent(inserted.id)}/calendar`,
        siteUrl
      ).toString();

      const doctorIcsUrl = new URL(
        `/api/appointments/${encodeURIComponent(inserted.id)}/calendar`,
        siteUrl
      );
      doctorIcsUrl.searchParams.set("audience", "doctor");

      patientText +=
        `\n\nAdd to Google Calendar: ${patientGoogleUrl}` +
        `\n\nAdd to Apple/Outlook (.ics): ${patientIcsUrl}` +
        `\n\n---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

      doctorText +=
        `\n\nAdd to Google Calendar: ${doctorGoogleUrl}` +
        `\n\nAdd to Apple/Outlook (.ics): ${doctorIcsUrl.toString()}` +
        `\n\n---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

      const doctorHtml = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">New appointment</h2>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><strong>Visit type:</strong> ${escapeHtml(visitType)}</p>
    ${
      visitNotes
        ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><strong>Notes:</strong> ${escapeHtml(visitNotes)}</p>`
        : ""
    }
    <p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><strong>Patient:</strong> ${escapeHtml(patientName)}</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><strong>Email:</strong> ${escapeHtml(patientEmail)}</p>
    <p style="margin:0 0 4px;font-size:15px;line-height:1.5;"><strong>When:</strong> ${escapeHtml(compactWhenLabel)} (Cyprus time)</p>

    <p style="${PRIMARY_ACTIONS_LABEL}">WhatsApp &amp; calendar</p>
    ${
      patientWaMe
        ? `<a href="${patientWaMe}" style="${WHATSAPP_CTA_STYLE}">💬 Chat on WhatsApp — ${escapeHtml(patientPhone)}</a>`
        : ""
    }
    <a href="${doctorGoogleUrl}" style="${CAL_GOOGLE_STYLE}">Add to Google Calendar</a>
    <a href="${doctorIcsUrl.toString()}" style="${CAL_ICS_STYLE}">Add to Apple / Outlook (.ics)</a>

    ${automatedEmailFooterHtml()}
  </div>
</div>`;

      // TODO: Change 'to' address to dynamic doctor/patient emails once domain is verified.
      await sendResendEmail({
        to: demoTo,
        subject: `New Appointment: ${visitType} — ${patientName} · ${compactWhenLabel}`,
        text: doctorText,
        html: doctorHtml,
      });

      // TODO: Change 'to' address to dynamic doctor/patient emails once domain is verified.
      const patientHtml = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">Appointment confirmed</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">Hi ${escapeHtml(patientName)},</p>
    <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      Your appointment with <strong>${escapeHtml(doctorName)}</strong> is confirmed for
      <strong>${escapeHtml(compactWhenLabel)}</strong> (Cyprus time).
    </p>
    <p style="margin:12px 0 4px;font-size:15px;line-height:1.6;color:#e2e8f0;"><strong>Visit type:</strong> ${escapeHtml(visitType)}</p>
    ${
      visitNotes
        ? `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#e2e8f0;"><strong>Notes:</strong> ${escapeHtml(visitNotes)}</p>`
        : ""
    }

    <p style="${PRIMARY_ACTIONS_LABEL}">WhatsApp &amp; calendar</p>
    ${
      doctorWaMe
        ? `<a href="${doctorWaMe}" style="${WHATSAPP_CTA_STYLE}">💬 Chat with ${escapeHtml(doctorName)} on WhatsApp</a>`
        : ""
    }
    <a href="${patientGoogleUrl}" style="${CAL_GOOGLE_STYLE}">Add to Google Calendar</a>
    <a href="${patientIcsUrl}" style="${CAL_ICS_STYLE}">Add to Apple / Outlook (.ics)</a>

    ${automatedEmailFooterHtml()}
  </div>
</div>`;

      await sendResendEmail({
        to: demoTo,
        subject: `Appointment confirmed — ${doctorName} · ${compactWhenLabel}`,
        text: patientText,
        html: patientHtml,
      });
    }
  } catch (err) {
    console.error("[DocCy] Failed to send appointment notification emails", err);
  }

  return NextResponse.json(
    {
      appointment: inserted,
      message: "Appointment booked successfully.",
    },
    { status: 201 }
  );
}

