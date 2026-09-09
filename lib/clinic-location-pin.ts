import { clinicLocationFromParts, type ClinicLocation } from "@/lib/clinic-location";
import { isCyprusDistrict, type CyprusDistrict } from "@/lib/cyprus-districts";
import {
  fallbackDistrictCoordinates,
  getDistanceKm,
  parseOptionalCoordinates,
  type Coordinates,
} from "@/lib/finder-distance";

/**
 * Shared logic for the map pin the doctor can move to place their clinic.
 *
 * Google Places gives us a building centroid, which is often the wrong side of
 * a block or a whole street away. Those coordinates drive the finder's distance
 * sorting, so the doctor gets to correct them by moving the map under a fixed
 * pin. The district is never recomputed from a pin move: nearest-centroid
 * inference can flip near a district boundary, so the doctor changes it
 * explicitly through the district select instead.
 */

/** Roughly a building's width. Below this, the pin is still "where Google put it". */
export const CLINIC_PIN_MOVED_THRESHOLD_METERS = 30;

/**
 * Far enough that the pin is unlikely to still be the searched address, used
 * only when reverse geocoding is unavailable and we cannot compare streets.
 */
export const CLINIC_PIN_FAR_FROM_ADDRESS_METERS = 200;

/** ~0.1 m. Google hands back a fresh LatLng on every idle event, so exact equality is useless. */
const COORDINATE_EPSILON_DEGREES = 1e-6;

export function coordinatesNearlyEqual(
  a: Coordinates | null | undefined,
  b: Coordinates | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.latitude - b.latitude) < COORDINATE_EPSILON_DEGREES &&
    Math.abs(a.longitude - b.longitude) < COORDINATE_EPSILON_DEGREES
  );
}

/** True once the doctor has meaningfully corrected Google's coordinates. */
export function clinicPinMoved(
  origin: Coordinates | null | undefined,
  current: Coordinates | null | undefined,
): boolean {
  if (!origin || !current) return false;
  return getDistanceKm(origin, current) * 1000 > CLINIC_PIN_MOVED_THRESHOLD_METERS;
}

export function clinicPinFarFromAddress(
  origin: Coordinates | null | undefined,
  current: Coordinates | null | undefined,
): boolean {
  if (!origin || !current) return false;
  return getDistanceKm(origin, current) * 1000 > CLINIC_PIN_FAR_FROM_ADDRESS_METERS;
}

/**
 * Google often prefixes a Cyprus address with the plus code of the point, e.g.
 * "QCJ3+VQV, Pindou, Chlorakas, Pafos 8015, Cyprus". Patients should never read
 * that, so it comes off before the address is shown or stored.
 */
const PLUS_CODE_PREFIX = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}\s*,?\s*/i;

export function stripPlusCodePrefix(address: string): string {
  return String(address ?? "")
    .trim()
    .replace(PLUS_CODE_PREFIX, "")
    .trim();
}

/** Street part of an address, without the number, for comparing two addresses. */
function streetKey(address: string): string {
  return String(address ?? "")
    .split(",")[0]!
    .toLowerCase()
    .replace(/[\d]/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the pin sits on a different street than the address text claims.
 *
 * Distance alone is a bad signal: moving 80 m to the right entrance of a large
 * complex keeps the address correct, while moving 80 m across a junction does
 * not. Comparing streets separates the two. A house number change is ignored —
 * the doctor knows their own number better than reverse geocoding does — and an
 * unnamed result (plus code, bare postcode) is treated as "cannot tell".
 */
export function clinicPinAddressConflicts(addressText: string, pinAddress: string): boolean {
  const current = streetKey(addressText);
  const underPin = streetKey(pinAddress);
  if (!current || !underPin) return false;
  return current !== underPin;
}

export function clinicLocationCoordinates(location: ClinicLocation): Coordinates | null {
  return parseOptionalCoordinates(location.latitude, location.longitude);
}

/** Where the map should open: the confirmed pin, else the district centre. */
export function clinicPinStartCoordinates(
  location: ClinicLocation,
  district: CyprusDistrict | null,
): Coordinates {
  return (
    clinicLocationCoordinates(location) ??
    fallbackDistrictCoordinates(district ?? location.district ?? "Nicosia")
  );
}

/**
 * Applies a pin move. Keeps the address text and place id (they still name the
 * clinic) and only replaces the coordinates.
 */
export function clinicLocationWithCoordinates(
  location: ClinicLocation,
  coords: Coordinates,
): ClinicLocation {
  return { ...location, latitude: coords.latitude, longitude: coords.longitude };
}

/** Builds the location for a doctor whose clinic Google does not know. */
export function manualClinicLocation(input: {
  address: string;
  district: string | null;
  coords: Coordinates;
}): ClinicLocation {
  return clinicLocationFromParts({
    address: input.address,
    latitude: input.coords.latitude,
    longitude: input.coords.longitude,
    placeId: null,
    district: isCyprusDistrict(String(input.district ?? "")) ? input.district : null,
    town: null,
  });
}
