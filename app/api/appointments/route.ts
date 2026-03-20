// app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CY_TZ } from "@/lib/appointments";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";
import { addMinutes, format } from "date-fns";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  isTimeWithinSettings,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import { sendResendEmail } from "@/lib/resend";
import type { DoctorRow } from "@/lib/doctors";
import { phoneToWaMeLink } from "@/lib/whatsapp";

function toGoogleCalendarUrl(opts: {
  title: string;
  description?: string;
  startUtc: Date;
  endUtc: Date;
}) {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(opts.startUtc)}/${fmt(opts.endUtc)}`,
    details: opts.description ?? "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
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
  } = body as {
    doctorId?: string;
    doctorSlug?: string;
    patientName?: string;
    patientEmail?: string;
    patientPhone?: string;
    appointmentLocal?: string; // "YYYY-MM-DDTHH:mm" in Europe/Nicosia
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
        { message: "Doctor not found for provided slug." },
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
        { message: "Doctor has not set availability yet." },
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
      { message: "Requested time is outside the doctor's availability." },
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
  const { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert({
      doctor_id: doctorId,
      patient_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
      appointment_datetime: appointmentUtc.toISOString(),
      status: "confirmed",
    })
    .select("id, appointment_datetime, status")
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

  // Notifications (best-effort) via Resend. Free tier: from must be onboarding@resend.dev;
  // demo often sends only to the doctor's verified inbox — see single email below.
  // Do not block booking success if notifications fail.
  try {
    const { data: doctor } = await supabase
      .from("doctors")
      .select("name, email, phone")
      .eq("id", doctorId)
      .single();

    const doctorRow = doctor as DoctorRow | null;
    const doctorName = doctorRow?.name ?? undefined;
    const doctorWaMe = phoneToWaMeLink(doctorRow?.phone);
    const patientWaMe = phoneToWaMeLink(patientPhone);

    const cyDate = appointmentToCyprusDate(inserted.appointment_datetime as string);
    const compactWhenLabel = format(cyDate, "EEE d MMM, HH:mm");
    const timeLabel = format(cyDate, "HH:mm");

    if (doctorName) {
      const demoTo = "rociosirvent@gmail.com";

      let patientText = `Hi ${patientName},\n\nYour appointment with ${doctorName} is confirmed for ${compactWhenLabel} (Cyprus time).`;
      if (doctorWaMe) {
        patientText += `\n\nChat with ${doctorName} on WhatsApp: ${doctorWaMe}`;
      }

      let doctorText = `New appointment\n\nPatient: ${patientName}\nPatient email: ${patientEmail}\nWhen: ${compactWhenLabel} (Cyprus time)`;
      if (patientWaMe || patientPhone) {
        doctorText += `\n\n💬 Chat on WhatsApp (${patientPhone}): ${patientWaMe ?? "N/A"}`;
      }

      const durationMinutes =
        (settings as DoctorSettingsRow | null)?.slot_duration_minutes ?? 30;

      const startUtc = new Date(inserted.appointment_datetime as string);
      const endUtc = addMinutes(startUtc, durationMinutes);

      const googleUrl = toGoogleCalendarUrl({
        title: `Appointment with ${patientName}`,
        description: doctorName,
        startUtc,
        endUtc,
      });

      const icsUrl = new URL(
        `/api/appointments/${encodeURIComponent(inserted.id)}/calendar`,
        siteUrl
      ).toString();

      doctorText +=
        `\n\nAdd to Google Calendar: ${googleUrl}` +
        `\n\nAdd to Apple/Outlook (.ics): ${icsUrl}`;

      const doctorHtml = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:20px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">New Appointment</h2>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><strong>Patient:</strong> ${patientName}</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><strong>Email:</strong> ${patientEmail}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;"><strong>When:</strong> ${compactWhenLabel} (Cyprus time)</p>

    ${
      patientWaMe
        ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;"><a href="${patientWaMe}" style="color:#86efac;text-decoration:none;">💬 Chat on WhatsApp (${patientPhone})</a></p>`
        : ""
    }

    <div style="margin-top:6px;">
      <a href="${googleUrl}" style="display:block;text-align:center;background:#34d399;color:#022c22;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;margin:0 0 10px;">
        Add to Google Calendar
      </a>
      <a href="${icsUrl}" style="display:block;text-align:center;background:rgba(52,211,153,.14);color:#a7f3d0;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;border:1px solid rgba(52,211,153,.35);">
        Add to Apple/Outlook
      </a>
    </div>
  </div>
</div>`;

      // TODO: Change 'to' address to dynamic doctor/patient emails once domain is verified.
      await sendResendEmail({
        to: demoTo,
        subject: `New Appointment: ${patientName} - ${compactWhenLabel}`,
        text: doctorText,
        html: doctorHtml,
      });

      // TODO: Change 'to' address to dynamic doctor/patient emails once domain is verified.
      await sendResendEmail({
        to: demoTo,
        subject: `Appointment confirmed — ${doctorName} · ${compactWhenLabel}`,
        text: patientText,
        html: `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:20px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">Appointment Confirmed</h2>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#e2e8f0;white-space:pre-line;">${escapeHtml(
      patientText
    )}</p>
  </div>
</div>`,
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

