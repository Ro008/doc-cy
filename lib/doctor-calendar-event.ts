import { CLINIC_ADDRESS } from "@/lib/clinic-info";
import { phoneToWaMeLink } from "@/lib/whatsapp";
import type {
  PatientCalendarDoctor,
  PatientCalendarEventDetails,
  PatientCalendarVisitReason,
} from "@/lib/patient-calendar-event";

/** Appointment fields the doctor needs on their calendar block (no patient email — privacy). */
export type DoctorCalendarAppointment = {
  patient_name?: string | null;
  patient_phone?: string | null;
};

/**
 * Calendar copy for the doctor/staff: title includes visit type when present.
 */
export function getDoctorCalendarEventDetails(
  appointment: DoctorCalendarAppointment,
  doctor: PatientCalendarDoctor,
  visit?: PatientCalendarVisitReason | null
): PatientCalendarEventDetails {
  const patientName =
    String(appointment.patient_name ?? "").trim() || "Patient";

  const reason = String(visit?.reason ?? "").trim();
  const vt = String(visit?.visitType ?? "").trim();
  const title = reason
    ? `Visit request: ${patientName}`
    : vt
      ? `${vt}: ${patientName}`
      : `🩺 Patient visit: ${patientName}`;

  const vn = String(visit?.visitNotes ?? "").trim();
  const lines: string[] = [
    "Booked through DocCy.",
    "",
  ];
  if (reason) {
    lines.push(`Reason: ${reason}`);
  } else if (vt) {
    lines.push(`Visit type: ${vt}`);
  }
  if (vn) {
    lines.push(`Notes: ${vn}`, "");
  }
  lines.push(`Patient: ${patientName}`);

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
