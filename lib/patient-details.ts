import { formatInTimeZone } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";

/**
 * What the professional sees about a patient on the agenda and the request page
 * (user, 2026-10-06): age, gender, first visit or not. Contact details are shown
 * alongside. Missing values (older bookings) are simply left out.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseBirthdate(value: string | null | undefined): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** Full months between the birth date and today (Cyprus), or null when unusable or in the future. */
function ageInMonths(birthdate: string | null | undefined, now: Date): number | null {
  const born = parseBirthdate(birthdate);
  if (!born) return null;
  const [y, m, d] = formatInTimeZone(now, CY_TZ, "yyyy-MM-dd").split("-").map(Number);
  const months = (y - born.y) * 12 + (m - born.m) - (d < born.d ? 1 : 0);
  return months < 0 ? null : months;
}

export function patientAgeYears(birthdate: string | null | undefined, now: Date = new Date()): number | null {
  const months = ageInMonths(birthdate, now);
  return months === null ? null : Math.floor(months / 12);
}

/** "36 years"; under 2, in months ("21 months"), which is what a paediatrician needs. */
function ageLabel(birthdate: string | null | undefined, now: Date): string | null {
  const months = ageInMonths(birthdate, now);
  if (months === null) return null;
  if (months < 24) return `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(months / 12);
  return `${years} years`;
}

/** "prefer_not_to_say" (and anything else) shows nothing. */
export function patientGenderLabel(gender: string | null | undefined): string | null {
  if (gender === "female") return "Female";
  if (gender === "male") return "Male";
  return null;
}

export function patientBirthdateLabel(birthdate: string | null | undefined): string | null {
  const born = parseBirthdate(birthdate);
  return born ? `born ${born.d} ${MONTHS[born.m - 1]} ${born.y}` : null;
}

/** "36 years", "Female", "First visit": the short line under the patient's name. */
export function patientSummaryParts(
  patient: { birthdate?: string | null; gender?: string | null; isNewPatient?: boolean | null },
  now: Date = new Date(),
): string[] {
  const parts: string[] = [];
  const age = ageLabel(patient.birthdate, now);
  if (age) parts.push(age);
  const gender = patientGenderLabel(patient.gender);
  if (gender) parts.push(gender);
  if (patient.isNewPatient === true) parts.push("First visit");
  if (patient.isNewPatient === false) parts.push("Returning patient");
  return parts;
}
