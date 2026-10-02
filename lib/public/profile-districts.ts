import { normalizeDistrictForSeoTitle } from "@/lib/doctor-seo-formatting";

/**
 * Districts shown in the profile hero: one per district where the professional has a
 * clinic (primary clinic's first), so two clinics in Nicosia and Paphos read
 * "Nicosia · Paphos", not just the primary one. Unknown names are left out.
 */
export function profileDistricts(input: {
  locations: ReadonlyArray<{ district?: string | null }>;
  fallback: string | null | undefined;
}): string[] {
  const districts: string[] = [];
  for (const location of input.locations) {
    const district = normalizeDistrictForSeoTitle(location.district);
    if (district && !districts.includes(district)) districts.push(district);
  }
  if (districts.length === 0) {
    const fallback = normalizeDistrictForSeoTitle(input.fallback);
    if (fallback) districts.push(fallback);
  }
  return districts;
}
