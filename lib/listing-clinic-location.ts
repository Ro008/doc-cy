import { compareClinicOrder } from "@/lib/clinic-order";

/**
 * Where a listing (unregistered professional) practises, read from its clinics.
 * Point E5 dropped the copies on `professionals` (district, town, address, map link,
 * pin, phone, clinic_id): every listing reads its location through
 * `professional_clinics`, like registered professionals already do.
 */
export const LISTING_CLINICS_SELECT =
  "listing_clinics:professional_clinics(sort_order, created_at, clinics(id, name, slug, phone, district, town, address, address_maps_link, latitude, longitude, is_archived))";

export type ListingClinicLocation = {
  clinicId: string;
  name: string | null;
  slug: string | null;
  /** The clinic has a public phone (the number itself is revealed on a click). */
  hasPhone: boolean;
  district: string | null;
  town: string | null;
  address: string | null;
  addressMapsLink: string | null;
  latitude: number | null;
  longitude: number | null;
};

type ListingClinicEmbed = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  phone?: string | null;
  district?: string | null;
  town?: string | null;
  address?: string | null;
  address_maps_link?: string | null;
  latitude?: unknown;
  longitude?: unknown;
  is_archived?: boolean | null;
};

type ListingClinicLink = {
  sort_order?: number | null;
  created_at?: string | null;
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

/** The row's unarchived clinics in the listing's clinic order, each once. */
export function listingClinicLocations(row: { listing_clinics?: unknown }): ListingClinicLocation[] {
  const links = Array.isArray(row.listing_clinics)
    ? [...(row.listing_clinics as ListingClinicLink[])].sort(compareClinicOrder)
    : [];
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
      name: text(clinic.name),
      slug: text(clinic.slug),
      hasPhone: text(clinic.phone) != null,
      district: text(clinic.district),
      town: text(clinic.town),
      address: text(clinic.address),
      addressMapsLink: text(clinic.address_maps_link),
      latitude: pinned ? latitude : null,
      longitude: pinned ? longitude : null,
    });
  }
  return out;
}
