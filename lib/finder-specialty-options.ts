import { specialtyToSlug } from "@/lib/finder-seo";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

export type FinderSpecialtyOption = { slug: string; label: string };

/** Slugs excluded from the finder specialty dropdown (e.g. overly generic labels); rows still appear unfiltered. */
const EXCLUDED_FINDER_SPECIALTY_SLUGS = new Set(["medicine", "pharmacy", "laboratory"]);

export type FinderSpecialtyOptionSource = {
  specialty?: string | null | undefined;
  /** GeSY multi-specialty cards; when present, each entry is absorbed. */
  specialties?: readonly string[] | null | undefined;
};

function canonicalSpecialtyOption(raw: string): FinderSpecialtyOption | null {
  const label = harmonizeFinderSpecialtyLabel(String(raw ?? "").trim());
  if (!label) return null;
  const slug = specialtyToSlug(label);
  if (!slug || slug === "all") return null;
  if (EXCLUDED_FINDER_SPECIALTY_SLUGS.has(slug)) return null;
  return { slug, label };
}

function collapseSpecialtyOptions(
  options: readonly FinderSpecialtyOption[],
): FinderSpecialtyOption[] {
  const slugToLabel = new Map<string, string>();
  for (const option of options) {
    const canonical = canonicalSpecialtyOption(option.label) ?? canonicalSpecialtyOption(option.slug);
    if (!canonical) continue;
    if (!slugToLabel.has(canonical.slug)) slugToLabel.set(canonical.slug, canonical.label);
  }
  return Array.from(slugToLabel.entries())
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

/**
 * Builds finder specialty dropdown options from directory rows only (no registration master list).
 * Manual rows are absorbed first; labels are harmonized before grouping by slug.
 */
export function buildFinderSpecialtyOptions(
  manualRows: readonly FinderSpecialtyOptionSource[],
  registeredRows: readonly FinderSpecialtyOptionSource[],
): FinderSpecialtyOption[] {
  const slugToLabel = new Map<string, string>();

  function absorbLabel(raw: string) {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return;
    // Never treat "Personal Doctor · Paediatrics" / "A; B" as one dropdown option.
    const parts = /[·;|]/.test(trimmed)
      ? trimmed.split(/[·;|]/).map((p) => p.trim()).filter(Boolean)
      : [trimmed];
    for (const part of parts) {
      const canonical = canonicalSpecialtyOption(part);
      if (!canonical) continue;
      if (!slugToLabel.has(canonical.slug)) slugToLabel.set(canonical.slug, canonical.label);
    }
  }

  function absorb(rows: readonly FinderSpecialtyOptionSource[]) {
    for (const row of rows) {
      const multi = Array.isArray(row.specialties)
        ? row.specialties.map((s) => String(s ?? "").trim()).filter(Boolean)
        : [];
      if (multi.length > 0) {
        for (const part of multi) absorbLabel(part);
        continue;
      }
      const raw = String(row.specialty ?? "").trim();
      if (raw) absorbLabel(raw);
    }
  }

  absorb(manualRows);
  absorb(registeredRows);

  return Array.from(slugToLabel.entries())
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

/**
 * Dropdown options + selected slug for the finder specialty <select>.
 *
 * Never invents a new option from the current URL / active filter. Spelling
 * variants (Haematology vs Hematology) collapse onto the canonical label.
 */
export function resolveFinderSpecialtyDropdown(
  options: readonly FinderSpecialtyOption[],
  activeSpecialty: string,
): { options: FinderSpecialtyOption[]; selectedSlug: string } {
  const list = collapseSpecialtyOptions(options);
  const trimmed = String(activeSpecialty ?? "").trim();
  if (!trimmed || /[·;|]/.test(trimmed)) {
    return { options: list, selectedSlug: "" };
  }
  const canonical = canonicalSpecialtyOption(trimmed);
  if (!canonical) return { options: list, selectedSlug: "" };
  const match = list.find((option) => option.slug === canonical.slug);
  return { options: list, selectedSlug: match?.slug ?? "" };
}
