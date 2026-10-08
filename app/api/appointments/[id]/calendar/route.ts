import { NextRequest, NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { getDoctorCalendarEventDetails } from "@/lib/doctor-calendar-event";
import { getCalendarEventDetails } from "@/lib/patient-calendar-event";
import { isConfirmedForCalendar } from "@/lib/appointment-status";
import { isAppointmentLinkExpired, verifyAppointmentLink } from "@/lib/appointment-links";
import { appointmentClinicCopy, loadAppointmentClinicPhone } from "@/lib/appointment-clinic-copy";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { linkIdForClinic, clinicSlotMinutes } from "@/lib/professional-account-settings";
import { loadPrimarySpecialtyName } from "@/lib/specialty-catalogue";

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

  // Links are signed per audience (lib/appointment-links.ts): the id alone is
  // not enough, and a patient link can't be turned into the professional's.
  const forDoctor = req.nextUrl.searchParams.get("audience") === "professional";
  const linkIsValid = verifyAppointmentLink({
    id: appointmentId,
    audience: forDoctor ? "professional" : "patient",
    sig: req.nextUrl.searchParams.get("sig"),
  });
  if (!linkIsValid) {
    return NextResponse.json({ message: "This calendar link is not valid." }, { status: 403 });
  }

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select(
      "id, professional_id, appointment_datetime, patient_name, patient_phone, status, created_at, reason, duration_minutes, clinic_id"
    )
    .eq("id", appointmentId)
    .single();

  if (apptError || !appointment) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (isAppointmentLinkExpired(appointment.appointment_datetime as string)) {
    return NextResponse.json({ message: "This calendar link has expired." }, { status: 410 });
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
    .from("professionals")
    .select("id, name, slug")
    .eq("id", appointment.professional_id)
    .single();
  const specialtyName = await loadPrimarySpecialtyName(
    supabase,
    appointment.professional_id as string,
  );

  const locations = await loadDoctorLocations(appointment.professional_id as string);
  const clinicId = (appointment as { clinic_id?: string | null }).clinic_id ?? null;
  const locationId = linkIdForClinic(locations, clinicId);

  const rowDur = Number(
    (appointment as { duration_minutes?: number | null }).duration_minutes
  );
  const durationMinutes =
    Number.isFinite(rowDur) && rowDur > 0
      ? rowDur
      : clinicSlotMinutes(locations, locationId);

  const startUtc = new Date(appointment.appointment_datetime as string);
  const endUtc = addMinutes(startUtc, durationMinutes);
  const createdUtc = new Date((appointment.created_at as string) ?? new Date().toISOString());

  const clinic = appointmentClinicCopy({ locations, clinicId });

  const doctorPayload = {
    name: doctor?.name,
    specialty: specialtyName,
    phone: await loadAppointmentClinicPhone(supabase, clinic.locationId),
    clinic_name: clinic.clinicName,
    clinic_address: clinic.address,
    maps_url: clinic.mapsUrl,
  };

  const apptRow = appointment as { reason?: string | null };
  const apptVisit = { reason: apptRow.reason };

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
        { includeDirectClinicContact: true }
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

