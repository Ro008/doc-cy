import { NextRequest, NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { getDoctorCalendarEventDetails } from "@/lib/doctor-calendar-event";
import { getCalendarEventDetails } from "@/lib/patient-calendar-event";
import { isConfirmedForCalendar } from "@/lib/appointment-status";

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

export async function GET(req: NextRequest, { params }: RouteContext) {
  const appointmentId = params.id;
  if (!appointmentId) {
    return NextResponse.json({ message: "Missing appointment id." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { message: "Server is not configured for calendar export." },
      { status: 503 }
    );
  }

  const forDoctor =
    req.nextUrl.searchParams.get("audience") === "doctor" ||
    req.nextUrl.searchParams.get("for") === "doctor";

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, appointment_datetime, patient_name, patient_phone, status, created_at, visit_type, visit_notes, reason, duration_minutes"
    )
    .eq("id", appointmentId)
    .single();

  if (apptError || !appointment) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (!isConfirmedForCalendar(appointment.status as string)) {
    return NextResponse.json(
      {
        message:
          "Calendar download is only available after the professional confirms this appointment.",
      },
      { status: 403 }
    );
  }

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, name, phone, slug, clinic_address, specialty")
    .eq("id", appointment.doctor_id)
    .single();

  const { data: settings } = await supabase
    .from("doctor_settings")
    .select("slot_duration_minutes")
    .eq("doctor_id", appointment.doctor_id)
    .single();

  const rowDur = Number(
    (appointment as { duration_minutes?: number | null }).duration_minutes
  );
  const durationMinutes =
    Number.isFinite(rowDur) && rowDur > 0
      ? rowDur
      : (settings as { slot_duration_minutes?: number | null } | null)
          ?.slot_duration_minutes ?? 30;

  const startUtc = new Date(appointment.appointment_datetime as string);
  const endUtc = addMinutes(startUtc, durationMinutes);
  const createdUtc = new Date((appointment.created_at as string) ?? new Date().toISOString());

  const doctorPayload = {
    name: doctor?.name,
    specialty: (doctor as { specialty?: string | null } | null)?.specialty,
    phone: doctor?.phone,
    clinic_address: (doctor as { clinic_address?: string | null } | null)?.clinic_address,
  };

  const apptRow = appointment as {
    visit_type?: string | null;
    visit_notes?: string | null;
    reason?: string | null;
  };
  const apptVisit = {
    reason: apptRow.reason,
    visitType: apptRow.visit_type,
    visitNotes: apptRow.visit_notes,
  };

  const cal = forDoctor
    ? getDoctorCalendarEventDetails(
        {
          patient_name: appointment.patient_name as string | null,
          patient_phone: (appointment as { patient_phone?: string | null }).patient_phone,
        },
        doctorPayload,
        apptVisit
      )
    : getCalendarEventDetails(
        {
          id: appointment.id as string,
          appointment_datetime: appointment.appointment_datetime as string,
        },
        doctorPayload,
        apptVisit,
        { includeWhatsAppContact: true }
      );

  const summary = cal.title;
  const description = cal.description;
  const clinicAddress = cal.location;

  const uid = forDoctor
    ? `${appointment.id}-doctor@doccy`
    : `${appointment.id}@doccy`;

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
      "Content-Disposition": `attachment; filename=\"appointment-${appointment.id}${forDoctor ? "-doctor" : ""}.ics\"`,
      "Cache-Control": "no-store",
    },
  });
}

