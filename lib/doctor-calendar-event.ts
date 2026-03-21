import { CLINIC_ADDRESS } from "@/lib/clinic-info";
import { phoneToWaMeLink } from "@/lib/whatsapp";
import type { PatientCalendarDoctor, PatientCalendarEventDetails } from "@/lib/patient-calendar-event";

/** Appointment fields the doctor needs on their calendar block. */
export type DoctorCalendarAppointment = {
  patient_name?: string | null;
  patient_email?: string | null;
  patient_phone?: string | null;
};

/**
 * Calendar copy for the doctor/staff: patient-forward title, contact details in description, clinic as location.
 * (Patient-facing events use `getCalendarEventDetails` in patient-calendar-event.ts — do not change that.)
 */
export function getDoctorCalendarEventDetails(
  appointment: DoctorCalendarAppointment,
  doctor: PatientCalendarDoctor
): PatientCalendarEventDetails {
  const patientName =
    String(appointment.patient_name ?? "").trim() || "Patient";

  const title = `🩺 Patient visit: ${patientName}`;

  const lines: string[] = [
    "Booked through DocCy.",
    "",
    `Patient: ${patientName}`,
  ];

  const email = String(appointment.patient_email ?? "").trim();
  if (email) {
    lines.push(`Email: ${email}`);
  }

  const phone = String(appointment.patient_phone ?? "").trim();
  if (phone) {
    lines.push(`Phone: ${phone}`);
  }

  const patientWa = phoneToWaMeLink(phone);
  if (patientWa) {
    lines.push(`WhatsApp patient: ${patientWa}`);
  }

  lines.push(
    "",
    "Tip: open your DocCy agenda to see this alongside your full schedule."
  );

  const description = lines.join("\n");

  const location =
    String(doctor.clinic_address ?? "").trim() || CLINIC_ADDRESS;

  return { title, description, location };
}
