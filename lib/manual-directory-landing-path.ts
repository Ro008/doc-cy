/** Public SEO landing pages for manual directory listings. */
export const MANUAL_DIRECTORY_LANDING_BASE_PATH = "/finder/professional";

export function manualDirectoryLandingPath(slug: string): string {
  const normalized = String(slug ?? "").trim();
  return normalized
    ? `${MANUAL_DIRECTORY_LANDING_BASE_PATH}/${encodeURIComponent(normalized)}`
    : MANUAL_DIRECTORY_LANDING_BASE_PATH;
}
