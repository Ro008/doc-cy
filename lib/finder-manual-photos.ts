/**
 * Optional curated photos for manual finder cards.
 * GeSY full-directory rebuild (2026-08): previous curated roster removed by product decision.
 * Re-add entries here keyed by normalized `directory_manual.address_maps_link` if needed later.
 */
const FINDER_MANUAL_PHOTOS_BY_MAPS_LINK: Record<string, string> = {};

function normalizeMapsLink(link: string): string {
  return link.trim().replace(/\/+$/, "");
}

export function getFinderManualPhotoUrl(addressMapsLink: string): string | null {
  const key = normalizeMapsLink(addressMapsLink);
  return FINDER_MANUAL_PHOTOS_BY_MAPS_LINK[key] ?? null;
}
