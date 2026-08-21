/**
 * Pure helpers for clinic roster UI: one card per professional, specialty chips filter.
 */

import {
  harmonizeFinderSpecialtyLabel,
  harmonizeFinderSpecialtyList,
} from "@/lib/finder-specialty-harmonize";

export type ClinicRosterProfessional = {
  id: string;
  displayName: string;
  specialty: string;
  specialties?: readonly string[] | null;
  /** False for inpatient-only (clinic roster secondary list). */
  finderVisible?: boolean;
};

export function clinicRosterSpecialtyKeys(pro: ClinicRosterProfessional): string[] {
  const fromArray = (pro.specialties ?? []).map((s) => String(s).trim()).filter(Boolean);
  const raw =
    fromArray.length > 0
      ? fromArray
      : [String(pro.specialty ?? "").trim()].filter(Boolean);
  const labels = harmonizeFinderSpecialtyList(raw);
  return labels.length > 0 ? labels : ["Specialty not set"];
}

/** Dedupe by id, then sort by display name. */
export function uniqueClinicRosterProfessionals<T extends ClinicRosterProfessional>(
  professionals: readonly T[],
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const pro of professionals) {
    const id = String(pro.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(pro);
  }
  return unique.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }),
  );
}

export function filterClinicRosterBySpecialty<T extends ClinicRosterProfessional>(
  professionals: readonly T[],
  activeSpecialty: string | null,
): T[] {
  const unique = uniqueClinicRosterProfessionals(professionals);
  if (!activeSpecialty) return unique;
  const canon = harmonizeFinderSpecialtyLabel(activeSpecialty);
  return unique.filter((pro) => clinicRosterSpecialtyKeys(pro).includes(canon));
}

/** Bookable (finder-visible) vs inpatient-only for clinic roster sections. */
export function splitClinicRosterByFinderVisibility<
  T extends ClinicRosterProfessional,
>(professionals: readonly T[]): { bookable: T[]; inpatientOnly: T[] } {
  const unique = uniqueClinicRosterProfessionals(professionals);
  const bookable: T[] = [];
  const inpatientOnly: T[] = [];
  for (const pro of unique) {
    if (pro.finderVisible === false) inpatientOnly.push(pro);
    else bookable.push(pro);
  }
  return { bookable, inpatientOnly };
}
