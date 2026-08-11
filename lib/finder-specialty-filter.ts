import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";
import { specialtyToSlug } from "@/lib/finder-seo";

function normalizeSpecialtyTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bdentistry\b/g, "dentist")
    .replace(/\bdental\b/g, "dentist")
    .replace(/\s+/g, " ")
    .trim();
}

/** Finder row specialty vs active filter (district/specialty URL or dropdown). */
export function matchesSpecialtyFilter(candidate: string, query: string): boolean {
  const normalizedQuery = String(query ?? "").trim();
  if (!normalizedQuery) return true;
  const candidateCanon = harmonizeFinderSpecialtyLabel(candidate);
  const queryCanon = harmonizeFinderSpecialtyLabel(normalizedQuery);
  if (specialtyToSlug(candidateCanon) === specialtyToSlug(queryCanon)) return true;
  const normalizedCandidate = normalizeSpecialtyTerm(candidate);
  const normalizedQueryFuzzy = normalizeSpecialtyTerm(normalizedQuery);
  // Avoid short filters like "ENT" matching "dentist" via substring.
  if (normalizedQueryFuzzy.length < 4) return false;
  return normalizedCandidate.includes(normalizedQueryFuzzy);
}

/** True if any specialty on a multi-specialty card matches the active filter. */
export function matchesAnySpecialtyFilter(
  candidates: readonly string[],
  query: string,
): boolean {
  const normalizedQuery = String(query ?? "").trim();
  if (!normalizedQuery) return true;
  if (!candidates.length) return false;
  return candidates.some((candidate) => matchesSpecialtyFilter(candidate, normalizedQuery));
}
