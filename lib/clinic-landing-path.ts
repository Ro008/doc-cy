/** Public clinic profile pages (`/clinics/{slug}`). */
export const CLINIC_LANDING_BASE_PATH = "/clinics";

export function clinicLandingPath(slug: string): string {
  const normalized = String(slug ?? "").trim();
  return normalized
    ? `${CLINIC_LANDING_BASE_PATH}/${encodeURIComponent(normalized)}`
    : CLINIC_LANDING_BASE_PATH;
}
