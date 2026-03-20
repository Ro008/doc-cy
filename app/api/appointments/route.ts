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

  const origin = new URL(req.url).origin;

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
    const doctorEmail = doctorRow?.email?.trim() || undefined;
    const doctorWaMe = phoneToWaMeLink(doctorRow?.phone);
    const patientWaMe = phoneToWaMeLink(patientPhone);

    const cyDate = appointmentToCyprusDate(inserted.appointment_datetime as string);
    const dateLabel = format(cyDate, "EEE d MMM yyyy");
    const timeLabel = format(cyDate, "HH:mm");

    if (doctorName) {
      const demoTo = "rociosirvent@gmail.com";

      let patientText = `Hi ${patientName},\n\nYour appointment with ${doctorName} is confirmed for ${dateLabel} at ${timeLabel} (Cyprus time).`;
      if (doctorEmail) {
        patientText += `\n\nDoctor contact: ${doctorName} <${doctorEmail}>.`;
      }
      if (doctorWaMe) {
        patientText += `\n\nChat with ${doctorName} on WhatsApp: ${doctorWaMe}`;
      }

      let doctorText = `New appointment\n\nPatient: ${patientName}\nPatient email: ${patientEmail}\nPhone: ${patientPhone}\nWhen: ${dateLabel} at ${timeLabel} (Cyprus time)`;
      if (doctorEmail) {
        doctorText += `\n\nDoctor email: ${doctorEmail}`;
      }
      if (patientWaMe) {
        doctorText += `\n\nMessage patient on WhatsApp: ${patientWaMe}`;
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
        origin
      ).toString();

      doctorText +=
        `\n\n[Add to Google Calendar]\n${googleUrl}` +
        `\n\n[Add to Apple/Outlook (.ics)]\n${icsUrl}`;

      // TODO: Change 'to' address to dynamic doctor/patient emails once domain is verified.
      await sendResendEmail({
        to: demoTo,
        subject: `New appointment — ${patientName} · ${dateLabel} ${timeLabel}`,
        text: doctorText,
      });

      // TODO: Change 'to' address to dynamic doctor/patient emails once domain is verified.
      await sendResendEmail({
        to: demoTo,
        subject: `Appointment confirmed — ${doctorName} · ${dateLabel} ${timeLabel}`,
        text: patientText,
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

