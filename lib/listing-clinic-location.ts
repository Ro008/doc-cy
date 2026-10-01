import type { Coordinates } from "@/lib/finder-distance";
import { computeFinderDistanceKm } from "@/lib/finder-distance";

/**
 * Where a listing (unregistered professional) practises, read from its clinics.
 * Point E5 dropped the copies on `professionals` (district, town, address, map link,
 * pin, phone, clinic_id): every listing reads its location through
 * `professional_clinics`, like registered professionals already do.
 */
export const LISTING_CLINICS_SELECT =
  "listing_clinics:professional_clinics(is_primary, clinics(id, district, town, address, address_maps_link, latitude, longitude, is_archived))";

export type ListingClinicLocation = {
  clinicId: string;
  isPrimary: boolean;
  district: string | null;
  town: string | null;
  address: string | null;
  addressMapsLink: string | null;
  latitude: number | null;
  longitude: number | null;
};

type ListingClinicEmbed = {
  id?: string | null;
  district?: string | null;
  town?: string | null;
  address?: string | null;
  address_maps_link?: string | null;
  latitude?: unknown;
  longitude?: unknown;
  is_archived?: boolean | null;
};

type ListingClinicLink = {
  is_primary?: boolean | null;
  /** PostgREST types an embed as an array; a to-one join still arrives as an object. */
  clinics?: ListingClinicEmbed | ListingClinicEmbed[] | null;
};

function text(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The row's unarchived clinics, primary first, the rest in join order, each once. */
export function listingClinicLocations(row: { listing_clinics?: unknown }): ListingClinicLocation[] {
  const links = Array.isArray(row.listing_clinics) ? (row.listing_clinics as ListingClinicLink[]) : [];
  const out: ListingClinicLocation[] = [];
  for (const link of links) {
    const clinic = Array.isArray(link?.clinics) ? link.clinics[0] : link?.clinics;
    if (!clinic || clinic.is_archived) continue;
    const clinicId = text(clinic.id);
    if (!clinicId || out.some((loc) => loc.clinicId === clinicId)) continue;
    const latitude = num(clinic.latitude);
    const longitude = num(clinic.longitude);
    const pinned = latitude != null && longitude != null;
    out.push({
      clinicId,
      isPrimary: Boolean(link.is_primary),
      district: text(clinic.district),
      town: text(clinic.town),
      address: text(clinic.address),
      addressMapsLink: text(clinic.address_maps_link),
      latitude: pinned ? latitude : null,
      longitude: pinned ? longitude : null,
    });
  }
  // Stable: only the primary moves to the front.
  return [...out.filter((loc) => loc.isPrimary), ...out.filter((loc) => !loc.isPrimary)];
}

function sameText(a: string | null, b: string | null | undefined): boolean {
  const right = String(b ?? "").trim().toLowerCase();
  return Boolean(right) && String(a ?? "").trim().toLowerCase() === right;
}

/**
 * The clinic a finder card leads with: among the clinics in the filtered district and
 * town (all clinics when none matches or there is no filter), the nearest one with a
 * pin for near-me, else the first (the primary when it qualifies).
 */
export function pickListingCardClinic(
  locations: readonly ListingClinicLocation[],
  filters: { district?: string | null; town?: string | null; coords?: Coordinates | null },
): ListingClinicLocation | null {
  if (locations.length === 0) return null;
  const matching = locations.filter(
    (loc) =>
      (!String(filters.district ?? "").trim() || sameText(loc.district, filters.district)) &&
      (!String(filters.town ?? "").trim() || sameText(loc.town, filters.town)),
  );
  const candidates = matching.length > 0 ? matching : locations;
  if (filters.coords) {
    let best: ListingClinicLocation | null = null;
    let bestKm = Infinity;
    for (const loc of candidates) {
      const km = computeFinderDistanceKm(filters.coords, loc.latitude, loc.longitude);
      if (km != null && km < bestKm) {
        best = loc;
        bestKm = km;
      }
    }
    if (best) return best;
  }
  return candidates[0] ?? null;
}
