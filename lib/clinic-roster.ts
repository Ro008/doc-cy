/**
 * Pure helpers for clinic roster UI: one card per professional, specialty chips filter.
 */

export type ClinicRosterProfessional = {
  id: string;
  displayName: string;
  specialty: string;
  specialties?: readonly string[] | null;
};

export function clinicRosterSpecialtyKeys(pro: ClinicRosterProfessional): string[] {
  const fromArray = (pro.specialties ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (fromArray.length > 0) return fromArray;
  const primary = String(pro.specialty ?? "").trim();
  return primary ? [primary] : ["Specialty not set"];
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
  return unique.filter((pro) => clinicRosterSpecialtyKeys(pro).includes(activeSpecialty));
}
