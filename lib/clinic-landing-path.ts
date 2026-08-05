/** Public clinic profile pages (not searchable in Finder v1). */
export const CLINIC_LANDING_BASE_PATH = "/finder/clinic";

export function clinicLandingPath(slug: string): string {
  const normalized = String(slug ?? "").trim();
  return normalized
    ? `${CLINIC_LANDING_BASE_PATH}/${encodeURIComponent(normalized)}`
    : CLINIC_LANDING_BASE_PATH;
}
