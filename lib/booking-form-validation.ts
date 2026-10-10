import { isPatientGender, parsePatientBirthdate } from "@/lib/booking-patient-fields";
import { isValidRegisterEmail } from "@/lib/register-email";
import { BOOKING_SERVICE_OTHER } from "@/lib/booking-service-choice";

/** Fields of the public booking form, in the order they appear on screen. */
export const BOOKING_FORM_FIELDS = [
  "patientName",
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
  | "nameRequired"
  | "emailRequired"
  | "validEmail"
  | "phoneRequired"
  | "validPhone"
  | "selectVisitHistory"
  | "genderRequired"
  | "birthdateRequired"
  | "serviceRequired"
  | "reasonRequired";

export type BookingFormValues = {
  patientName: string;
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
 * The first problem in the form, top to bottom, so the page can say exactly what is missing
 * and take the patient to that field (instead of one generic "complete all details").
 */
export function firstBookingFormError(
  v: BookingFormValues,
  now: Date = new Date(),
): BookingFormError | null {
  if (!v.patientName.trim()) return { field: "patientName", messageKey: "nameRequired" };
  if (!v.patientEmail.trim()) return { field: "patientEmail", messageKey: "emailRequired" };
  // Same check as the server (lib/booking-patient-fields.ts).
  if (!isValidRegisterEmail(v.patientEmail)) return { field: "patientEmail", messageKey: "validEmail" };
  // The phone box keeps the country code (e.g. "+357") after the number is erased: that is empty too.
  if (v.patientPhone.replace(/\D/g, "").length <= 3) return { field: "patientPhone", messageKey: "phoneRequired" };
  if (!v.phoneValid) return { field: "patientPhone", messageKey: "validPhone" };
  if (v.isNewPatient === null) return { field: "isNewPatient", messageKey: "selectVisitHistory" };
  if (!isPatientGender(v.patientGender)) return { field: "patientGender", messageKey: "genderRequired" };
  if (!parsePatientBirthdate(v.patientBirthdate, now)) {
    return { field: "patientBirthdate", messageKey: "birthdateRequired" };
  }
  const choice = v.serviceChoice ?? null;
  if (choice === "") return { field: "professionalService", messageKey: "serviceRequired" };
  // A chosen service is the reason; the free text is only for Other (or no picker).
  const needsReason = choice === null || choice === BOOKING_SERVICE_OTHER;
  if (needsReason && !v.visitReason.trim()) return { field: "visitReason", messageKey: "reasonRequired" };
  return null;
}
