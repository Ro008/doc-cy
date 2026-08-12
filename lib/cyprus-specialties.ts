/**
 * Registration / settings specialty master list.
 *
 * Primary source: GeSY directory labels (`GESY_MANUAL_SPECIALTIES`), minus
 * Pharmacy / Laboratory (not offered as DocCy booking specialties yet).
 *
 * DocCy exception (not a GeSY segment label): `Psychology` — for non-clinical
 * psychologists / coaches who are not GeSY Clinical Psychologists.
 *
 * Legacy Cyprus labels remain accepted by `isMasterSpecialty` so already-registered
 * doctors (e.g. Dentistry) are not forced into "Other" until they edit.
 */
import { GESY_MANUAL_SPECIALTIES } from "@/lib/gesy-specialties";

/** Excluded from registration even though present in the GeSY Excel vocabulary. */
const REGISTRATION_EXCLUDED_GESY = new Set(["Pharmacy", "Laboratory"]);

/** Prefer Cyprus spelling when GeSY list has near-duplicates. */
const GESY_REGISTRATION_DEDUPE_DROP = new Set(["Hematology"]); // keep Haematology

/**
 * DocCy-only addition alongside GeSY (Stephan Meyer / non-clinical psychology).
 * Kept distinct from GeSY `Clinical Psychologist`.
 */
export const DOCCY_EXTRA_REGISTRATION_SPECIALTIES = ["Psychology"] as const;

/** Pre-GeSY registration labels — still valid for existing doctor rows.
 * DEFERRED CLEANUP (another branch, after this GeSY specialty work is merged):
 * delete/archive test doctors still using these labels, then remove this list and
 * the grandfathering in `isMasterSpecialty` / SpecialtyCombobox.
 * See `.cursor/rules/deferred-legacy-specialty-cleanup.mdc`.
 * Do not treat DocCy `Psychology` as legacy — that stays.
 */
export const LEGACY_CYPRUS_REGISTRATION_SPECIALTIES = [
  "General Practice",
  "Dentistry",
  "Pediatrics",
  "Dermatology",
  "Gynecology",
  "Laser & Medical Aesthetics",
  "Physiotherapy & Rehabilitation",
  "Nutrition & Dietetics",
  "Wellness",
  "Orthopedics",
  "ENT",
  "Oncology",
  "Pulmonology",
  "Nephrology",
] as const;

function buildRegistrationMasterList(): string[] {
  const fromGesy = GESY_MANUAL_SPECIALTIES.filter(
    (label) =>
      !REGISTRATION_EXCLUDED_GESY.has(label) && !GESY_REGISTRATION_DEDUPE_DROP.has(label),
  );
  const merged = new Set<string>([
    ...fromGesy,
    ...DOCCY_EXTRA_REGISTRATION_SPECIALTIES,
  ]);
  return Array.from(merged).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

/**
 * Options shown in register / settings / specialty-review dropdowns.
 * Sorted A–Z for scannability (longer GeSY list).
 */
export const CYPRUS_MASTER_SPECIALTIES = buildRegistrationMasterList();

export type CyprusMasterSpecialty = (typeof CYPRUS_MASTER_SPECIALTIES)[number];

/** Shown as the last option; doctors who pick this enter a custom string (pending approval). */
export const SPECIALTY_OTHER_LABEL = "Other (Specify)" as const;

const MASTER_SET = new Set<string>(CYPRUS_MASTER_SPECIALTIES);
const LEGACY_SET = new Set<string>(LEGACY_CYPRUS_REGISTRATION_SPECIALTIES as unknown as string[]);

/** True for current master picks and grandfathered legacy labels. */
export function isMasterSpecialty(value: string): boolean {
  const trimmed = value.trim();
  return MASTER_SET.has(trimmed) || LEGACY_SET.has(trimmed);
}

/** True only for labels offered in the combobox today (not legacy-only). */
export function isCurrentRegistrationSpecialty(value: string): boolean {
  return MASTER_SET.has(value.trim());
}
