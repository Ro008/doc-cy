/**
 * Curated photos for manual finder cards (GSC / popular searches).
 * Keys are normalized Google Maps links from `directory_manual.address_maps_link`.
 *
 * Preserved roster (keep assets + map entries across directory_manual replacements):
 * - Valentina Oflidou (Dermatology, Paphos)
 * - Vera Politou (Dermatology, Paphos)
 * - Korina Tryfonos (Dermatology, Paphos)
 * - Georgina Sarika (Dermatology, Paphos)
 *
 * See `.cursor/rules/manual-directory-preserved-photos.mdc`.
 */
const FINDER_MANUAL_PHOTOS_BY_MAPS_LINK: Record<string, string> = {
  "https://maps.google.com/?cid=1665628448012477822&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA":
    "/finder/manual-photos/valentina-oflidou.png",
  "https://maps.google.com/?cid=15591583625893490566&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA":
    "/finder/manual-photos/vera-politou.png",
  "https://maps.google.com/?cid=9115583058084629147&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA":
    "/finder/manual-photos/korina-tryfonos.png",
  "https://maps.google.com/?cid=14943462510182054898&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA":
    "/finder/manual-photos/georgina-sarika.png",
};

function normalizeMapsLink(link: string): string {
  return link.trim().replace(/\/+$/, "");
}

export function getFinderManualPhotoUrl(addressMapsLink: string): string | null {
  const key = normalizeMapsLink(addressMapsLink);
  return FINDER_MANUAL_PHOTOS_BY_MAPS_LINK[key] ?? null;
}
