/**
 * Canonical specialties for Cyprus directory integrity.
 * Order is stable for display; "Other (Specify)" is UI-only (never stored as specialty text).
 */
export const CYPRUS_MASTER_SPECIALTIES = [
  "General Practice",
  "Dentistry",
  "Pediatrics",
  "Dermatology",
  "Gynecology",
  "Physiotherapy",
  "Psychology",
  "Cardiology",
  "Orthopedics",
  "Ophthalmology",
  "ENT",
  "Urology",
  "Psychiatry",
  "Endocrinology",
  "Oncology",
  "Neurology",
  "Gastroenterology",
  "Pulmonology",
  "Rheumatology",
  "Nephrology",
] as const;

export type CyprusMasterSpecialty = (typeof CYPRUS_MASTER_SPECIALTIES)[number];

/** Shown as the last option; doctors who pick this enter a custom string (pending approval). */
export const SPECIALTY_OTHER_LABEL = "Other (Specify)" as const;

const MASTER_SET = new Set<string>(CYPRUS_MASTER_SPECIALTIES as unknown as string[]);

export function isMasterSpecialty(value: string): boolean {
  return MASTER_SET.has(value.trim());
}
