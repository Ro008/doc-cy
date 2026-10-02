/**
 * Gender and date of birth on the public booking form (user, 2026-10-02: every field
 * is required).
 *
 * BACKEND PENDING (Livio) — contract the frontend already uses:
 * - `POST /api/appointments` body gains `patientGender` ("male" | "female" |
 *   "prefer_not_to_say") and `patientDateOfBirth` ("YYYY-MM-DD").
 * - Store them, e.g. `appointments.patient_gender text` and
 *   `appointments.patient_date_of_birth date`; validate with PATIENT_GENDERS and
 *   validateDateOfBirth; show them to the professional where the patient's details are.
 * Today the API ignores unknown fields: bookings work, these two values are NOT STORED.
 */

export const PATIENT_GENDERS = ["male", "female", "prefer_not_to_say"] as const;
export type PatientGender = (typeof PATIENT_GENDERS)[number];

export const BOOKING_PATIENT_DETAILS_BACKEND = {
  endpoint: "POST /api/appointments",
  bodyFields: ["patientGender", "patientDateOfBirth"],
  columns: ["appointments.patient_gender", "appointments.patient_date_of_birth"],
} as const;

const MAX_AGE_YEARS = 120;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** min/max for the date input: today, back to 120 years ago. */
export function dateOfBirthBounds(today: Date): { min: string; max: string } {
  const oldest = new Date(today.getFullYear() - MAX_AGE_YEARS, today.getMonth(), today.getDate());
  return { min: dateKey(oldest), max: dateKey(today) };
}

export type DateOfBirthError = "missing" | "invalid" | "future" | "too_old";

export function validateDateOfBirth(value: string, today: Date): DateOfBirthError | null {
  const raw = value.trim();
  if (!raw) return "missing";
  const match = DATE_RE.exec(raw);
  if (!match) return "invalid";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return "invalid";
  }
  const { min, max } = dateOfBirthBounds(today);
  if (raw > max) return "future";
  if (raw < min) return "too_old";
  return null;
}

export function bookingPatientDetailsPayload(input: {
  gender: PatientGender;
  dateOfBirth: string;
}): { patientGender: PatientGender; patientDateOfBirth: string } {
  return { patientGender: input.gender, patientDateOfBirth: input.dateOfBirth.trim() };
}
