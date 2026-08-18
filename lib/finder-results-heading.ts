/**
 * Patient-facing results H1 (visible page heading only).
 * Keep SEO <title> separate.
 */
export function buildFinderResultsHeading(params: {
  specialtyLabel?: string | null;
  districtLabel?: string | null;
  nearYou?: boolean;
  unfilteredFallback?: string;
}): string {
  const specialty = params.specialtyLabel?.trim() || "";
  const district = params.districtLabel?.trim() || "";
  const fallback =
    params.unfilteredFallback ?? "The most complete health directory in Cyprus";

  if (params.nearYou && !district) {
    if (specialty) return `${specialty} near you`;
    return "Health professionals near you";
  }

  if (specialty && district) return `${specialty} in ${district}`;
  if (specialty) return `${specialty} in Cyprus`;
  if (district) return `Health professionals in ${district}`;
  return fallback;
}

/**
 * Supporting line under the results H1. Place lives in the H1;
 * this line only adds coverage. The handwritten “and book online.” is separate.
 */
export function buildFinderResultsSnippet(params: {
  specialtyLabel?: string | null;
  districtLabel?: string | null;
  nearYou?: boolean;
}): string | null {
  const specialty = params.specialtyLabel?.trim() || "";
  const district = params.districtLabel?.trim() || "";

  if (params.nearYou && !district) {
    return specialty
      ? "Find a specialist in your area"
      : "Find any specialist in your area";
  }

  if (specialty && district) return "Find a specialist in this district";
  if (specialty) return "Find a specialist anywhere on the island";
  if (district) return "Find any specialist in this district";
  return null;
}

export function buildClinicsResultsHeading(params: {
  districtLabel?: string | null;
  nearYou?: boolean;
  unfilteredFallback?: string;
}): string {
  const district = params.districtLabel?.trim() || "";
  const fallback =
    params.unfilteredFallback ?? "The largest directory of clinics in Cyprus";
  if (params.nearYou && !district) return "Clinics near you";
  if (district) return `Clinics in ${district}`;
  return fallback;
}

export function buildClinicsResultsSnippet(params: {
  districtLabel?: string | null;
  nearYou?: boolean;
}): string | null {
  const district = params.districtLabel?.trim() || "";
  if (params.nearYou && !district) return "Find a clinic in your area";
  if (district) return "Find a clinic in this district";
  return null;
}
