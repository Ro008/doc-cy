import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";
import type { Coordinates } from "@/lib/finder-distance";
import { loadGoogleMapsPlaces } from "@/lib/google-maps-loader";

/**
 * Reverse geocoding for a moved clinic pin.
 *
 * When the doctor drags the pin off the address they searched for, the address
 * text stops describing it. Rather than rewrite it silently — a small nudge to
 * the right entrance should keep the good address they picked — we look up what
 * is actually under the pin and offer it as a choice.
 *
 * Billed as the Geocoding SKU (10,000 no-cost events per month). If the API is
 * not enabled on the key this resolves to null and the doctor still has Undo
 * and the search box.
 */

export type ReverseGeocodedPin = {
  address: string;
  addressComponents: google.maps.GeocoderAddressComponent[];
};

/**
 * Only street-level results are usable. A locality or postcode result ("8015
 * Chlorakas, Cyprus") tells us nothing about which street the pin is on, and
 * offering it as the clinic address would be worse than what the doctor picked.
 */
const STREET_LEVEL_TYPES = ["street_address", "premise", "subpremise", "route"];

let geocoder: google.maps.Geocoder | null = null;

export async function reverseGeocodeClinicPin(
  coords: Coordinates,
): Promise<ReverseGeocodedPin | null> {
  try {
    const maps = await loadGoogleMapsPlaces();
    geocoder = geocoder ?? new maps.Geocoder();

    const response = await geocoder.geocode({
      location: { lat: coords.latitude, lng: coords.longitude },
    });

    // Results come back most specific first. Keep the street-level ones, drop
    // the plus code Google prefixes onto many Cyprus addresses, and prefer a
    // result that never had one over a salvaged one.
    const candidates = response.results
      .filter((result) => (result.types ?? []).some((type) => STREET_LEVEL_TYPES.includes(type)))
      .map((result) => {
        const original = String(result.formatted_address ?? "").trim();
        const address = stripPlusCodePrefix(original);
        return { result, address, hadPlusCode: address !== original };
      })
      .filter((candidate) => candidate.address.length > 0);

    const best = candidates.find((candidate) => !candidate.hadPlusCode) ?? candidates[0];
    if (!best) return null;

    return {
      address: best.address,
      addressComponents: best.result.address_components ?? [],
    };
  } catch {
    return null;
  }
}
