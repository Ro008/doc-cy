/**
 * Curated photos for manual finder cards (GSC / popular searches).
 * Keys are normalized Google Maps links from `directory_manual.address_maps_link`.
 */
const FINDER_MANUAL_PHOTOS_BY_MAPS_LINK: Record<string, string> = {
  "https://maps.app.goo.gl/RDejcWME7Xr6tZtM6": "/finder/manual-photos/valentina-oflidou.png",
  "https://maps.app.goo.gl/qmagUZLsBgrBreXE9": "/finder/manual-photos/vera-politou.png",
  "https://maps.app.goo.gl/FwGDUQnrbQKUMasn8": "/finder/manual-photos/korina-tryfonos.png",
  "https://maps.app.goo.gl/6uNG7ajS1UeZU96Q7": "/finder/manual-photos/georgina-sarika.png",
};

function normalizeMapsLink(link: string): string {
  return link.trim().replace(/\/+$/, "");
}

export function getFinderManualPhotoUrl(addressMapsLink: string): string | null {
  const key = normalizeMapsLink(addressMapsLink);
  return FINDER_MANUAL_PHOTOS_BY_MAPS_LINK[key] ?? null;
}
