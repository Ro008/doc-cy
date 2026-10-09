/**
 * Which GeSY rows the directory import keeps (`scripts/import-gesy-directory-batch.mjs`).
 *
 * `segment` is the GeSY provider category from the export spreadsheet, not a column
 * on `professionals` (dropped in Point E2).
 * - Pharmacy and Laboratory are later product surfaces: never imported.
 * - Inpatient Services is hospital care with no public profile: a person listed only
 *   there is not imported (Point E2 deleted the 89 such listings). A person with a
 *   bookable segment too is imported, with all their non Pharmacy/Laboratory clinics.
 */

const PHARMACY_LAB_SEGMENTS = new Set(["Pharmacy", "Laboratory"]);

export const BATCH_SEGMENT_MAP = {
  "personal-doctor": new Set(["Personal Doctor"]),
  dentist: new Set(["Dentist"]),
  allied: new Set(["Allied Health Professional"]),
  outpatient: new Set(["Outpatient Specialist"]),
  "nurse-midwife": new Set(["Nurse or Midwife"]),
  "accidents-emergency": new Set(["Accidents & Emergency Department"]),
};

/** @param {{ segments: Set<string> }} person @param {string} batchKey */
export function personBelongsInBatch(person, batchKey) {
  const wanted = BATCH_SEGMENT_MAP[batchKey];
  if (!wanted) return false;
  return [...person.segments].some((s) => wanted.has(s));
}

/**
 * @template {{ segments: Set<string> }} T
 * @param {readonly T[]} clinics
 * @returns {T[]}
 */
export function importableClinics(clinics) {
  return clinics.filter((c) => [...c.segments].some((s) => !PHARMACY_LAB_SEGMENTS.has(s)));
}
