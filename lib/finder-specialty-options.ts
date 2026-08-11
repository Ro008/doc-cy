import { specialtyToSlug } from "@/lib/finder-seo";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

export type FinderSpecialtyOption = { slug: string; label: string };

/** Slugs excluded from the finder specialty dropdown (e.g. overly generic labels); rows still appear unfiltered. */
const EXCLUDED_FINDER_SPECIALTY_SLUGS = new Set(["medicine", "pharmacy"]);

export type FinderSpecialtyOptionSource = {
  specialty?: string | null | undefined;
  /** GeSY multi-specialty cards; when present, each entry is absorbed. */
  specialties?: readonly string[] | null | undefined;
};

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
      const label = harmonizeFinderSpecialtyLabel(part);
      if (!label) continue;
      const slug = specialtyToSlug(label);
      if (slug === "all") continue;
      if (EXCLUDED_FINDER_SPECIALTY_SLUGS.has(slug)) continue;
      if (!slugToLabel.has(slug)) slugToLabel.set(slug, label);
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
