import type { PatientAges } from "@/lib/settings-profile-details";

/**
 * What the public profile shows of Settings › Profile: "Patients I see" (a fact of the hero)
 * and the qualifications (their own section). Nothing shows for what she has not filled in.
 */

const PATIENT_AGES_MESSAGE_KEYS: Record<PatientAges, string> = {
  adults: "heroSeesAdults",
  children: "heroSeesChildren",
  all: "heroSeesAll",
};

/** Key in the `DoctorProfilePage` messages, or null when she has not chosen. */
export function patientAgesMessageKey(ages: PatientAges | null): string | null {
  return ages ? PATIENT_AGES_MESSAGE_KEYS[ages] : null;
}

/**
 * Qualifications as a CV lists them, newest first (user, 2026-10-14). Lines without a year
 * keep her own order, after the dated ones.
 */
export function qualificationsNewestFirst<T extends { year: number | null }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.year === b.year) return 0;
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return b.year - a.year;
  });
}
