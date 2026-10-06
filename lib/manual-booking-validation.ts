import { parsePatientBirthdate } from "@/lib/booking-patient-fields";
import { isValidRegisterEmail } from "@/lib/register-email";
import { manualPhoneProblem } from "@/lib/phone-number";

export { manualPhoneProblem };

/**
 * "Add manual booking" (the professional types in a phone or walk-in patient). Only name,
 * phone and reason are required (Rocío, 2026-10-06); first visit, gender, email and birth date
 * are optional but checked when filled in.
 */
export type ManualBookingField = "patientName" | "patientPhone" | "patientEmail" | "patientBirthdate" | "reason";

export type ManualBookingValues = {
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  patientBirthdate: string;
  reason: string;
};

export type ManualBookingError = { field: ManualBookingField; message: string };

/** The first problem, in the order the fields appear in the modal. */
export function firstManualBookingError(
  v: ManualBookingValues,
  now: Date = new Date(),
): ManualBookingError | null {
  if (!v.patientName.trim()) return { field: "patientName", message: "Enter the patient's name." };
  const phone = manualPhoneProblem(v.patientPhone);
  if (phone === "required") return { field: "patientPhone", message: "Enter the patient's phone number." };
  if (phone === "invalid") {
    return {
      field: "patientPhone",
      message: "Use digits only, with an optional + at the start (7 to 15 digits).",
    };
  }
  if (v.patientBirthdate.trim() && !parsePatientBirthdate(v.patientBirthdate, now)) {
    return { field: "patientBirthdate", message: "Enter a real date of birth, or leave it empty." };
  }
  if (v.patientEmail.trim() && !isValidRegisterEmail(v.patientEmail)) {
    return { field: "patientEmail", message: "Check the email address, or leave it empty." };
  }
  if (!v.reason.trim()) return { field: "reason", message: "Enter a short reason for the visit." };
  return null;
}
