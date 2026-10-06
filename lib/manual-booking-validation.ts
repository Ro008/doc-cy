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
  /** From the phone box (length check) and the mobile check. */
  phoneValid?: boolean;
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
  // The phone box keeps the country code (e.g. "+357") after the number is erased: empty too.
  if (v.patientPhone.replace(/\D/g, "").length <= 3) {
    return { field: "patientPhone", message: "Enter the patient's phone number." };
  }
  if (v.phoneValid === false) {
    return { field: "patientPhone", message: "Enter a valid mobile number for the selected country." };
  }
  const phone = manualPhoneProblem(v.patientPhone);
  if (phone === "required") return { field: "patientPhone", message: "Enter the patient's phone number." };
  if (phone === "invalid") {
    return {
      field: "patientPhone",
      message: "Enter a valid mobile number with its country code.",
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
