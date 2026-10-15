import { buildMapsUrlFromAddress, buildMapsUrlFromClinicLocation } from "@/lib/clinic-info";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";
import { clinicTitleOrFallback } from "@/lib/doctor-locations";

/**
 * "Clinics & contact" on the public profile: one card per place the professional
 * sees patients, each with its address, map link and the clinic's phone (every
 * public phone is the clinic's). A clinic phone that matches no place keeps its
 * own card so it is never lost.
 */

export type ProfileClinicLocation = {
  id: string;
  label?: string | null;
  clinic_address?: string | null;
  town?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  clinic_place_id?: string | null;
};

export type ProfilePhoneClinic = {
  id: string | null;
  name: string;
  hasPhone: boolean;
};

export type ProfileClinicCard = {
  key: string;
  title: string;
  address: string;
  mapsUrl: string;
  /** Only with several clinics: the one the booking calendar is showing. */
  isBookingHere: boolean;
  /** Clinic id for RevealPhoneButton, when that clinic has a phone. */
  phoneClinicId: string | null;
};

export function buildProfileClinicCards(input: {
  locations: readonly ProfileClinicLocation[];
  clinicForLocation: (location: ProfileClinicLocation) => ProfilePhoneClinic | null;
  phoneClinics: readonly ProfilePhoneClinic[];
  selectedLocationId: string | null;
  fallbackTitle: (clinicNumber: number) => string;
  missingAddress: string;
  /** Profile-level address when the professional has no clinic rows. */
  fallbackAddress?: string | null;
}): ProfileClinicCard[] {
  const several = input.locations.length > 1;
  const usedPhoneIds = new Set<string>();

  const cards: ProfileClinicCard[] = input.locations.map((location, index) => {
    const clinic = input.clinicForLocation(location);
    const phoneClinicId = clinic?.hasPhone && clinic.id ? clinic.id : null;
    if (phoneClinicId) usedPhoneIds.add(phoneClinicId);
    const street = stripPlusCodePrefix(String(location.clinic_address ?? ""));
    const address =
      street ||
      String(location.town ?? "").trim() ||
      String(location.district ?? "").trim() ||
      input.missingAddress;
    return {
      key: location.id,
      title: clinicTitleOrFallback(location.label, input.fallbackTitle(index + 1)),
      address,
      mapsUrl:
        buildMapsUrlFromClinicLocation({
          address: location.clinic_address,
          latitude: location.latitude,
          longitude: location.longitude,
          placeId: location.clinic_place_id,
        }) ||
        (street ? buildMapsUrlFromAddress(street) : null) ||
        "",
      isBookingHere: several && location.id === input.selectedLocationId,
      phoneClinicId,
    };
  });

  if (cards.length === 0) {
    const address = stripPlusCodePrefix(String(input.fallbackAddress ?? ""));
    if (address) {
      cards.push({
        key: "profile-address",
        title: input.fallbackTitle(1),
        address,
        mapsUrl: buildMapsUrlFromAddress(address) ?? "",
        isBookingHere: false,
        phoneClinicId: null,
      });
    }
  }

  for (const clinic of input.phoneClinics) {
    if (!clinic.hasPhone || !clinic.id || usedPhoneIds.has(clinic.id)) continue;
    usedPhoneIds.add(clinic.id);
    cards.push({
      key: `phone-${clinic.id}`,
      title: clinic.name,
      address: "",
      mapsUrl: "",
      isBookingHere: false,
      phoneClinicId: clinic.id,
    });
  }

  return cards;
}
