import { NextRequest, NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { supabase } from "@/lib/supabase";
import { phoneToWaMeLink } from "@/lib/whatsapp";
import { CLINIC_ADDRESS, MAPS_URL } from "@/lib/clinic-info";

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
    .select("id, name, phone, slug, clinic_address")
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

  const doctorName = (doctor?.name ?? "").trim();
  const doctorPhone = (doctor?.phone ?? "").trim();
  const doctorWaMeLink = phoneToWaMeLink(doctorPhone) ?? "";
  const clinicAddress =
    (doctor as { clinic_address?: string | null } | null)?.clinic_address
      ?.trim() || CLINIC_ADDRESS;
  const mapsUrl =
    clinicAddress === CLINIC_ADDRESS
      ? MAPS_URL
      : `https://maps.google.com/?q=${encodeURIComponent(clinicAddress)}`;

  const summary = doctorName
    ? `🩺 Appointment with Dr. ${doctorName}`
    : "🩺 Appointment";

  const description = [
    `WhatsApp: ${doctorWaMeLink || doctorPhone || "N/A"}`,
    `Address: ${mapsUrl}`,
  ].join("\n");

  const uid = `${appointment.id}@doccy`;

  const icsParts = [
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
    `LOCATION:${escapeIcsText(clinicAddress)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  const ics = icsParts.join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"appointment-${appointment.id}.ics\"`,
      "Cache-Control": "no-store",
    },
  });
}

