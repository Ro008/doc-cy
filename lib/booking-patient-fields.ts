import { formatInTimeZone } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import { parseIsNewPatient } from "@/lib/patient-visit-status";
import { isValidRegisterEmail } from "@/lib/register-email";
import { manualPhoneProblem } from "@/lib/phone-number";
import { normalizeAppointmentReason } from "@/lib/visit-types";

/**
 * The patient details every booking needs (user, 2026-10-02). All required; the email
 * is optional for manual bookings (phone / walk-in patients). Mirrors the database's
 * `appointments_booking_fields_check`, which enforces the same for new rows.
 */

export const PATIENT_GENDER_OPTIONS = ["female", "male", "prefer_not_to_say"] as const;
export type PatientGender = (typeof PATIENT_GENDER_OPTIONS)[number];

export type BookingSource = "online" | "manual";

export type BookingPatientFields = {
  patientName: string;
  patientEmail: string | null;
  patientPhone: string;
  /** null only on manual bookings, where it is optional (Rocío, 2026-10-06). */
  isNewPatient: boolean | null;
  reason: string;
  /** null only on manual bookings. */
  patientGender: PatientGender | null;
  /** YYYY-MM-DD; null only on manual bookings. */
  patientBirthdate: string | null;
};

// Optional `undefined` fields on each branch: no strictNullChecks in this project.
export type BookingPatientFieldsResult =
  | { ok: true; fields: BookingPatientFields; message?: undefined }
  | { ok: false; message: string; fields?: undefined };

const EARLIEST_BIRTHDATE = "1900-01-01";

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function isPatientGender(value: unknown): value is PatientGender {
  return typeof value === "string" && (PATIENT_GENDER_OPTIONS as readonly string[]).includes(value);
}

/** A real calendar date, YYYY-MM-DD, from 1900 up to today (Cyprus). */
export function parsePatientBirthdate(value: unknown, now: Date = new Date()): string | null {
  const s = clean(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const todayCyprus = formatInTimeZone(now, CY_TZ, "yyyy-MM-dd");
  if (s < EARLIEST_BIRTHDATE || s > todayCyprus) return null;
  return s;
}

export function parseBookingPatientFields(
  raw: Record<string, unknown>,
  source: BookingSource,
  now: Date = new Date(),
): BookingPatientFieldsResult {
  const patientName = clean(raw.patientName);
  if (!patientName) return { ok: false, message: "Please enter the patient's full name." };

  const emailRaw = clean(raw.patientEmail);
  if (!emailRaw && source === "online") return { ok: false, message: "Please enter an email address." };
  if (emailRaw && !isValidRegisterEmail(emailRaw)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  const patientPhone = clean(raw.patientPhone);
  if (!patientPhone) return { ok: false, message: "Please enter a phone number." };
  // Typed by the professional (no phone widget): digits and separators, 7 to 15 digits.
  if (source === "manual" && manualPhoneProblem(patientPhone)) {
    return { ok: false, message: "Please enter a valid phone number (digits, optional + at the start)." };
  }

  // Manual bookings: only name, phone and reason are required; the rest is checked when
  // given (Rocío, 2026-10-06). Online bookings require everything.
  const optional = source === "manual";

  const isNewPatient = parseIsNewPatient(raw.isNewPatient);
  if (isNewPatient === null && !optional) {
    return { ok: false, message: "Please tell us if this is the first visit with this professional." };
  }

  const reason = normalizeAppointmentReason(raw.reason);
  if (!reason) return { ok: false, message: "Please tell us briefly why you need this visit." };

  const gender = clean(raw.patientGender);
  if (!(optional && !gender) && !isPatientGender(gender)) {
    return { ok: false, message: "Please choose a gender option." };
  }

  const birthdateRaw = clean(raw.patientBirthdate);
  const patientBirthdate = optional && !birthdateRaw ? null : parsePatientBirthdate(raw.patientBirthdate, now);
  if (!patientBirthdate && !(optional && !birthdateRaw)) {
    return { ok: false, message: "Please enter a valid date of birth." };
  }

  return {
    ok: true,
    fields: {
      patientName,
      patientEmail: emailRaw || null,
      patientPhone,
      isNewPatient,
      reason,
      patientGender: isPatientGender(gender) ? gender : null,
      patientBirthdate,
    },
  };
}
