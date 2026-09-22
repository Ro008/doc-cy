import { specialtyToSlug } from "@/lib/finder-seo";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

/**
 * Approved specialty names offered in the register / settings / founder comboboxes:
 * the `specialties` catalogue (see `loadSpecialtyCatalogueNames`). Client-safe, so
 * pages load it on the server and pass it down.
 */
export type SpecialtyCatalogueNames = readonly string[];

/** Shown as the last option; picking it means typing a custom label (pending approval). */
export const SPECIALTY_OTHER_LABEL = "Other (Specify)" as const;

/**
 * The catalogue name `value` refers to. `viaAlias` is true when it only matched
 * through a legacy spelling (`Pediatrics` -> `Paediatrics`), which the comboboxes no
 * longer offer.
 */
export function matchCatalogueSpecialty(
  catalogue: SpecialtyCatalogueNames,
  value: string,
): { name: string; viaAlias: boolean } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const bySlug = new Map(catalogue.map((name) => [specialtyToSlug(name), name]));
  const direct = bySlug.get(specialtyToSlug(trimmed));
  if (direct) return { name: direct, viaAlias: false };
  const alias = bySlug.get(specialtyToSlug(harmonizeFinderSpecialtyLabel(trimmed)));
  return alias ? { name: alias, viaAlias: true } : null;
}

/** True when `value` is one of the catalogue names offered in the comboboxes. */
export function isCatalogueSpecialty(
  catalogue: SpecialtyCatalogueNames,
  value: string,
): boolean {
  const match = matchCatalogueSpecialty(catalogue, value);
  return match !== null && !match.viaAlias;
}

/**
 * Master specialties shown in a combobox, minus ones already used on other rows.
 * The current row's selection stays available even if listed in `exclude`.
 */
export function filterAvailableMasterSpecialties(
  masters: readonly string[],
  exclude: readonly string[],
  keepSelected?: string | null,
): string[] {
  const excluded = new Set(
    exclude.map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const keep = String(keepSelected ?? "").trim().toLowerCase();
  if (keep) excluded.delete(keep);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of masters) {
    const key = label.trim().toLowerCase();
    if (!key || excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** True when two or more non-empty specialty labels collide (case-insensitive). */
export function hasDuplicateSpecialtyLabels(
  labels: readonly string[],
): boolean {
  const seen = new Set<string>();
  for (const label of labels) {
    const key = label.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
