import type { PatientAges } from "@/lib/settings-profile-details";

/**
 * What the public profile shows of Settings › Profile: "Patients I see" (a line of About)
 * and the qualifications (their own section). Nothing shows for what she has not filled in.
 */

const PATIENT_AGES_MESSAGE_KEYS: Record<PatientAges, string> = {
  adults: "patientsAdults",
  children: "patientsChildren",
  all: "patientsAll",
};

/** Key in the `DoctorProfilePage` messages, or null when she has not chosen. */
export function patientAgesMessageKey(ages: PatientAges | null): string | null {
  return ages ? PATIENT_AGES_MESSAGE_KEYS[ages] : null;
}

/** The line under a qualification's title: where, and the year when she gave one. */
export function qualificationDetail(qualification: { institution: string; year: number | null }): string {
  return [qualification.institution.trim(), qualification.year ? String(qualification.year) : ""]
    .filter(Boolean)
    .join(" · ");
}
