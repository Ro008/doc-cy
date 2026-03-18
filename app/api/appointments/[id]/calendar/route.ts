import { NextRequest, NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { supabase } from "@/lib/supabase";

type RouteContext = {
  params: { id: string };
};

function formatIcsUtc(dt: Date) {
  return dt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const appointmentId = params.id;
  if (!appointmentId) {
    return NextResponse.json({ message: "Missing appointment id." }, { status: 400 });
  }

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select("id, doctor_id, appointment_datetime, patient_name, status, created_at")
    .eq("id", appointmentId)
    .single();

  if (apptError || !appointment) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, name")
    .eq("id", appointment.doctor_id)
    .single();

  const { data: settings } = await supabase
    .from("doctor_settings")
    .select("slot_duration_minutes")
    .eq("doctor_id", appointment.doctor_id)
    .single();

  const durationMinutes =
    (settings as { slot_duration_minutes?: number | null } | null)
      ?.slot_duration_minutes ?? 30;

  const startUtc = new Date(appointment.appointment_datetime as string);
  const endUtc = addMinutes(startUtc, durationMinutes);
  const createdUtc = new Date((appointment.created_at as string) ?? new Date().toISOString());

  const summary = doctor?.name
    ? `Appointment with ${doctor.name}`
    : "Appointment";

  const description = doctor?.name
    ? `Appointment confirmed with ${doctor.name}.`
    : "Appointment confirmed.";

  const uid = `${appointment.id}@doccy`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DocCy//Patient Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${formatIcsUtc(createdUtc)}`,
    `DTSTART:${formatIcsUtc(startUtc)}`,
    `DTEND:${formatIcsUtc(endUtc)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"appointment-${appointment.id}.ics\"`,
      "Cache-Control": "no-store",
    },
  });
}

