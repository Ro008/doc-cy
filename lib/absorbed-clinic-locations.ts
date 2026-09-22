import { MAX_DOCTOR_LOCATIONS } from "@/lib/doctor-locations";
import { sameClinicAddress } from "@/lib/public/finder-card-clinic-match";

/**
 * Practice locations to create for the clinics an absorb just moved onto a
 * registered professional.
 *
 * Locations and clinic links are still two systems (Stage 1 unified the join table,
 * the read cutover comes later): cards and profiles render `doctor_locations`, while
 * a claimed listing brings its workplace across as a `professional_clinics` row. So
 * after Verify the clinic exists on the professional, is listed on that clinic's own
 * page — and is invisible on their own profile.
 *
 * That is a silent loss. The clinic was public on the listing right up to the moment
 * we verified them, and it is a place they told us they work. Verify should merge the
 * two records, not quietly drop half of one.
 *
 * Added locations are never primary and never open for bookings: the address the
 * professional registered stays their main one, and a schedule is something only they
 * can set. If they have in fact left the place, deleting a location is one click in
 * their dashboard — whereas a workplace that vanishes on verification is something
 * neither they nor we would notice.
 */

export type AbsorbedClinic = {
  id?: string | null;
  address?: string | null;
  town?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  clinic_place_id?: string | null;
};

export type ExistingLocation = {
  clinic_address?: string | null;
  sort_order?: number | null;
};

export type LocationToAdd = {
  clinic_address: string;
  town: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  clinic_place_id: string | null;
  is_primary: false;
  sort_order: number;
  pause_online_bookings: true;
};

export function locationsToAddForAbsorbedClinics(input: {
  clinics: readonly AbsorbedClinic[];
  existingLocations: readonly ExistingLocation[];
  maxLocations?: number;
}): LocationToAdd[] {
  const cap = input.maxLocations ?? MAX_DOCTOR_LOCATIONS;
  const taken = input.existingLocations.map((row) => String(row.clinic_address ?? "").trim());
  const highestSortOrder = input.existingLocations.reduce(
    (max, row) => Math.max(max, Number(row.sort_order ?? 0)),
    0,
  );

  const out: LocationToAdd[] = [];
  let sortOrder = highestSortOrder;

  for (const clinic of input.clinics) {
    if (input.existingLocations.length + out.length >= cap) break;

    const address = String(clinic.address ?? "").trim();
    if (!address) continue;
    // Same matcher the card uses to decide whether a clinic belongs to an address, so
    // the two can never disagree about what counts as "already there".
    if (taken.some((existing) => sameClinicAddress(address, existing))) continue;

    sortOrder += 1;
    out.push({
      clinic_address: address,
      town: String(clinic.town ?? "").trim() || null,
      district: String(clinic.district ?? "").trim() || null,
      latitude: typeof clinic.latitude === "number" ? clinic.latitude : null,
      longitude: typeof clinic.longitude === "number" ? clinic.longitude : null,
      clinic_place_id: String(clinic.clinic_place_id ?? "").trim() || null,
      is_primary: false,
      sort_order: sortOrder,
      pause_online_bookings: true,
    });
    taken.push(address);
  }

  return out;
}
