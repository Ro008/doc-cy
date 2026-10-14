// The emails the demo patients receive, built with the app's own builders (lib/send-patient-*-email.ts)
// from the demo doctor's data (seed-demo.mjs): what the videos show after "your patient is notified".
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { appointmentToCyprusDate } from "@/lib/appointments";
import { patientCancelDeadlineLabel } from "@/lib/appointment-links-db";
import { clinicMapsUrl } from "@/lib/clinic-info";
import { buildPatientAppointmentConfirmedEmailContent } from "@/lib/send-patient-appointment-confirmed-email";
import { buildPatientRequestDeclinedEmailContent } from "@/lib/send-patient-request-declined-email";
import { buildPatientRescheduleProposalEmailContent } from "@/lib/send-patient-reschedule-proposal-email";

import type { DemoEmail } from "./helpers";

const SITE_URL = "https://www.mydoccy.com";
const FROM = "DocCy <no-reply@mydoccy.com>";

const DOCTOR = {
  name: "Elena Christou",
  slug: "elena-christou",
  specialty: "General Practice",
  phone: "25999010",
};
const CLINIC = {
  name: "Christou Family Clinic",
  address: "24 Makarios Avenue, Limassol",
  phone: "25999010",
};
const PROFILE_URL = `${SITE_URL}/en/${DOCTOR.slug}`;
const MAPS_URL =
  clinicMapsUrl({ latitude: 34.6841, longitude: 33.0379, address: CLINIC.address }) ??
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CLINIC.address)}`;

type Patient = { name: string; email: string };

/** "Your appointment is confirmed", sent when the doctor accepts a request. */
export function confirmedEmail(patient: Patient, appointment: { id: string; startIso: string; reason?: string | null }): DemoEmail {
  const content = buildPatientAppointmentConfirmedEmailContent({
    siteUrl: SITE_URL,
    patientEmail: patient.email,
    patientName: patient.name,
    appointmentId: appointment.id,
    appointmentDatetimeIso: appointment.startIso,
    durationMinutes: 30,
    reason: appointment.reason ?? null,
    doctor: { name: DOCTOR.name, specialty: DOCTOR.specialty, phone: DOCTOR.phone, clinic_address: CLINIC.address },
    clinic: { clinicName: CLINIC.name, address: CLINIC.address, mapsUrl: MAPS_URL },
    profileUrl: PROFILE_URL,
    cancel: { url: `${SITE_URL}/booking/cancel?token=demo`, deadlineLabel: patientCancelDeadlineLabel(appointment.startIso, 12) },
  });
  return { from: FROM, to: patient.email, subject: content.subject, html: content.html };
}

/** "Update on your request", sent when the doctor declines, with her message. */
export function declinedEmail(patient: Patient, message: string): DemoEmail {
  const content = buildPatientRequestDeclinedEmailContent({
    siteUrl: SITE_URL,
    patientName: patient.name,
    doctorName: DOCTOR.name,
    doctorSlug: DOCTOR.slug,
    declineReason: message,
    clinic: { name: CLINIC.name, address: CLINIC.address, mapsUrl: MAPS_URL, phone: CLINIC.phone, profileUrl: PROFILE_URL },
  });
  return { from: FROM, to: patient.email, subject: content.subject, html: content.html };
}

/** "Choose your appointment time", sent when the doctor suggests other times. */
export function proposalEmail(patient: Patient, slotIsos: string[]): DemoEmail {
  const content = buildPatientRescheduleProposalEmailContent({
    patientName: patient.name,
    chooseUrl: `${SITE_URL}/booking/choose?token=demo`,
    proposalExpiresAtIso: new Date(Date.now() + 24 * 3600e3).toISOString(),
    doctorName: DOCTOR.name,
    slotLabelsCyprus: slotIsos.map((iso) =>
      format(appointmentToCyprusDate(iso), "EEEE, d MMMM yyyy 'at' HH:mm", { locale: enUS }),
    ),
    clinic: { name: CLINIC.name, address: CLINIC.address, mapsUrl: MAPS_URL, phone: CLINIC.phone, profileUrl: PROFILE_URL },
  });
  return { from: FROM, to: patient.email, subject: content.subject, html: content.html };
}
