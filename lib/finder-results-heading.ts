/**
 * Patient-facing results H1 (action-oriented booking copy).
 * Keep SEO <title> separate — this is visible page heading only.
 */
export function buildFinderResultsHeading(params: {
  specialtyLabel?: string | null;
  districtLabel?: string | null;
  unfilteredFallback?: string;
}): string {
  const specialty = params.specialtyLabel?.trim() || "";
  const district = params.districtLabel?.trim() || "";
  const fallback =
    params.unfilteredFallback ?? "Find your next health professional in Cyprus";

  if (specialty && district) {
    return `Book ${indefiniteArticle(specialty)} ${specialty} appointment in ${district}`;
  }
  if (specialty) {
    return `Book ${indefiniteArticle(specialty)} ${specialty} appointment in Cyprus`;
  }
  if (district) {
    return `Book an appointment in ${district}`;
  }
  return fallback;
}

/**
 * Supporting sentence under the results H1 when district and/or specialty filters are active.
 * Place lives in the H1 when both are set; the snippet always leads with “professionals in …”.
 */
export function buildFinderResultsSnippet(params: {
  specialtyLabel?: string | null;
  districtLabel?: string | null;
}): string | null {
  const specialty = params.specialtyLabel?.trim() || "";
  const district = params.districtLabel?.trim() || "";
  if (!specialty && !district) return null;

  const focus = specialty || district;
  return `Find English-speaking professionals in ${focus}. Compare profiles and book online with confidence.`;
}

export function buildClinicsResultsHeading(params: {
  districtLabel?: string | null;
  unfilteredFallback?: string;
}): string {
  const district = params.districtLabel?.trim() || "";
  const fallback = params.unfilteredFallback ?? "Find clinics in Cyprus";
  if (district) return `Find clinics in ${district}`;
  return fallback;
}

function indefiniteArticle(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}
