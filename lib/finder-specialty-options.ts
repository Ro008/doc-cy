import { specialtyToSlug } from "@/lib/finder-seo";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

export type FinderSpecialtyOption = { slug: string; label: string };

/** Slugs excluded from the finder specialty dropdown (e.g. overly generic labels); rows still appear unfiltered. */
const EXCLUDED_FINDER_SPECIALTY_SLUGS = new Set(["medicine"]);

/**
 * Builds finder specialty dropdown options from directory rows only (no registration master list).
 * Manual rows are absorbed first; labels are harmonized (e.g. Ob/Gyn → Gynecology) before grouping by slug.
 */
export function buildFinderSpecialtyOptions(
  manualRows: readonly { specialty: string | null | undefined }[],
  registeredRows: readonly { specialty: string | null | undefined }[]
): FinderSpecialtyOption[] {
  const slugToLabel = new Map<string, string>();

  function absorb(rows: readonly { specialty: string | null | undefined }[]) {
    for (const row of rows) {
      const raw = String(row.specialty ?? "").trim();
      if (!raw) continue;
      const label = harmonizeFinderSpecialtyLabel(raw);
      if (!label) continue;
      const slug = specialtyToSlug(label);
      if (slug === "all") continue;
      if (EXCLUDED_FINDER_SPECIALTY_SLUGS.has(slug)) continue;
      if (!slugToLabel.has(slug)) slugToLabel.set(slug, label);
    }
  }

  absorb(manualRows);
  absorb(registeredRows);

  return Array.from(slugToLabel.entries())
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}
