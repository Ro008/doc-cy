import { isPatientGender, parsePatientBirthdate } from "@/lib/booking-patient-fields";
import { isValidRegisterEmail } from "@/lib/register-email";
import { onlineBookingPhoneProblem } from "@/lib/phone-number";
import { BOOKING_SERVICE_OTHER } from "@/lib/booking-service-choice";

/** Fields of the public booking form, in the order they appear on screen. */
export const BOOKING_FORM_FIELDS = [
  // Two boxes since 2026-10-10 (the clinic needs the surname); sent joined as patientName.
  "patientFirstName",
  "patientLastName",
  "patientEmail",
  "patientPhone",
  "isNewPatient",
  "patientGender",
  "patientBirthdate",
  "professionalService",
  "visitReason",
] as const;

export type BookingFormField = (typeof BOOKING_FORM_FIELDS)[number];

/** Keys under BookingPage.errors in messages/*.json. */
export type BookingFormErrorKey =
  | "firstNameRequired"
  | "lastNameRequired"
  | "emailRequired"
  | "validEmail"
  | "phoneRequired"
  | "validPhone"
  | "validMobile"
  | "validMobileCy"
  | "selectVisitHistory"
  | "genderRequired"
  | "birthdateRequired"
  | "serviceRequired"
  | "reasonRequired";

export type BookingFormValues = {
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string;
  patientPhone: string;
  phoneValid: boolean;
  isNewPatient: boolean | null;
  patientGender: string;
  patientBirthdate: string;
  /**
   * The service picker: null/undefined when the professional lists no services (no picker),
   * "" while nothing is chosen, a service id, or "other" (then the reason is typed).
   */
  serviceChoice?: string | null;
  visitReason: string;
};

export type BookingFormError = { field: BookingFormField; messageKey: BookingFormErrorKey };

/**
 * Every problem in the form, one per field, in the order the fields appear on screen (2026-10-11):
 * the page marks them all at once and takes the patient to the first, instead of one field per
 * press of Send.
 */
export function allBookingFormErrors(v: BookingFormValues, now: Date = new Date()): BookingFormError[] {
  const errors: BookingFormError[] = [];
  const add = (field: BookingFormField, messageKey: BookingFormErrorKey) => errors.push({ field, messageKey });

  if (!v.patientFirstName.trim()) add("patientFirstName", "firstNameRequired");
  if (!v.patientLastName.trim()) add("patientLastName", "lastNameRequired");
  if (!v.patientEmail.trim()) add("patientEmail", "emailRequired");
  // Same check as the server (lib/booking-patient-fields.ts).
  else if (!isValidRegisterEmail(v.patientEmail)) add("patientEmail", "validEmail");
  // The phone box keeps the country code (e.g. "+357") after the number is erased: that is empty too.
  if (v.patientPhone.replace(/\D/g, "").length <= 3) add("patientPhone", "phoneRequired");
  else if (!v.phoneValid) add("patientPhone", "validPhone");
  // A real mobile for its country, the same rule as the server (2026-10-10).
  else if (onlineBookingPhoneProblem(v.patientPhone)) {
    const cyprus = v.patientPhone.replace(/[^\d+]/g, "").startsWith("+357");
    add("patientPhone", cyprus ? "validMobileCy" : "validMobile");
  }
  if (v.isNewPatient === null) add("isNewPatient", "selectVisitHistory");
  if (!isPatientGender(v.patientGender)) add("patientGender", "genderRequired");
  if (!parsePatientBirthdate(v.patientBirthdate, now)) add("patientBirthdate", "birthdateRequired");
  const choice = v.serviceChoice ?? null;
  if (choice === "") add("professionalService", "serviceRequired");
  // A chosen service is the reason; the free text is only for Other (or no picker).
  else if ((choice === null || choice === BOOKING_SERVICE_OTHER) && !v.visitReason.trim()) {
    add("visitReason", "reasonRequired");
  }
  return errors;
}

/** The first problem, for callers that only need where to take the patient. */
export function firstBookingFormError(
  v: BookingFormValues,
  now: Date = new Date(),
): BookingFormError | null {
  return allBookingFormErrors(v, now)[0] ?? null;
}
