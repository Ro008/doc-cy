import {
  CYPRUS_DISTRICTS,
  isCyprusDistrict,
  type CyprusDistrict,
} from "@/lib/cyprus-districts";
import {
  inferCyprusTownFromClinic,
  type AddressComponentLike,
} from "@/lib/cyprus-towns";
import {
  fallbackDistrictCoordinates,
  getDistanceKm,
  isLikelyCyprusCoordinates,
  parseOptionalCoordinates,
  type Coordinates,
} from "@/lib/finder-distance";

export type ClinicLocation = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  district: CyprusDistrict | null;
  town: string | null;
};

type AddressComponent = AddressComponentLike;

const DISTRICT_TEXT_ALIASES: Record<string, CyprusDistrict> = {
  nicosia: "Nicosia",
  lefkosia: "Nicosia",
  lefkosa: "Nicosia",
  strovolos: "Nicosia",
  lakatamia: "Nicosia",
  engomi: "Nicosia",
  aglantzia: "Nicosia",
  limassol: "Limassol",
  lemesos: "Limassol",
  germasogeia: "Limassol",
  paphos: "Paphos",
  pafos: "Paphos",
  larnaca: "Larnaca",
  larnaka: "Larnaca",
  famagusta: "Famagusta",
  ammochostos: "Famagusta",
  "ayia napa": "Famagusta",
  "agia napa": "Famagusta",
  polis: "Paphos",
};

export function emptyClinicLocation(): ClinicLocation {
  return {
    address: "",
    latitude: null,
    longitude: null,
    placeId: null,
    district: null,
    town: null,
  };
}

function inferDistrictFromText(text: string): CyprusDistrict | null {
  const normalized = text.toLowerCase();
  for (const district of CYPRUS_DISTRICTS) {
    if (normalized.includes(district.toLowerCase())) return district;
  }
  for (const [alias, district] of Object.entries(DISTRICT_TEXT_ALIASES)) {
    if (normalized.includes(alias)) return district;
  }
  return null;
}

function inferDistrictFromCoordinates(coords: Coordinates): CyprusDistrict {
  let nearest: CyprusDistrict = "Nicosia";
  let nearestDistanceKm = Number.POSITIVE_INFINITY;
  for (const district of CYPRUS_DISTRICTS) {
    const distanceKm = getDistanceKm(coords, fallbackDistrictCoordinates(district));
    if (distanceKm < nearestDistanceKm) {
      nearestDistanceKm = distanceKm;
      nearest = district;
    }
  }
  return nearest;
}

export function inferCyprusDistrictFromClinic(input: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  addressComponents?: AddressComponent[];
}): CyprusDistrict | null {
  for (const component of input.addressComponents ?? []) {
    const fromComponent = inferDistrictFromText(
      `${component.long_name ?? ""} ${component.short_name ?? ""}`,
    );
    if (fromComponent) return fromComponent;
  }

  const fromAddress = inferDistrictFromText(String(input.address ?? ""));
  if (fromAddress) return fromAddress;

  const coords = parseOptionalCoordinates(input.latitude, input.longitude);
  if (coords && isLikelyCyprusCoordinates(coords)) {
    return inferDistrictFromCoordinates(coords);
  }

  return null;
}

export function clinicLocationFromParts(input: {
  address?: string | null;
  latitude?: unknown;
  longitude?: unknown;
  placeId?: string | null;
  district?: string | null;
  town?: string | null;
  addressComponents?: AddressComponent[] | null;
}): ClinicLocation {
  const coords = parseOptionalCoordinates(input.latitude, input.longitude);
  const districtRaw = String(input.district ?? "").trim();
  const district = isCyprusDistrict(districtRaw) ? districtRaw : null;
  const address = String(input.address ?? "").trim();
  return {
    address,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    placeId: input.placeId?.trim() || null,
    district:
      district ??
      (coords
        ? inferCyprusDistrictFromClinic({
            address: input.address,
            latitude: coords.latitude,
            longitude: coords.longitude,
          })
        : null),
    town: inferCyprusTownFromClinic({
      town: input.town,
      address,
      addressComponents: input.addressComponents,
    }),
  };
}

export function hasConfirmedClinicCoordinates(location: ClinicLocation): boolean {
  const coords = parseOptionalCoordinates(location.latitude, location.longitude);
  return Boolean(coords && isLikelyCyprusCoordinates(coords));
}

export function clinicLocationRequiresSelection(
  location: ClinicLocation,
  initialAddress: string,
): boolean {
  const nextAddress = location.address.trim();
  if (!nextAddress) return false;
  if (hasConfirmedClinicCoordinates(location)) return false;
  return nextAddress !== initialAddress.trim();
}
