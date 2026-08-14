import type { CyprusDistrict } from "@/lib/cyprus-districts";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

const DISTRICT_CENTER_COORDS: Record<CyprusDistrict, Coordinates> = {
  Nicosia: { latitude: 35.1856, longitude: 33.3823 },
  Limassol: { latitude: 34.7071, longitude: 33.0226 },
  Paphos: { latitude: 34.7754, longitude: 32.4245 },
  Larnaca: { latitude: 34.9182, longitude: 33.6232 },
  Famagusta: { latitude: 35.1147, longitude: 33.9500 },
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function getDistanceKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function isValidCoordinate(value: unknown, kind: "lat" | "lon"): value is number {
  if (typeof value !== "number" || Number.isNaN(value)) return false;
  if (kind === "lat") return value >= -90 && value <= 90;
  return value >= -180 && value <= 180;
}

export function parseOptionalCoordinates(
  latitude: unknown,
  longitude: unknown,
): Coordinates | null {
  const lat = typeof latitude === "number" ? latitude : Number(latitude);
  const lon = typeof longitude === "number" ? longitude : Number(longitude);
  if (!isValidCoordinate(lat, "lat")) return null;
  if (!isValidCoordinate(lon, "lon")) return null;
  // Common placeholder/no-data pair in many datasets.
  if (Math.abs(lat) < 0.000001 && Math.abs(lon) < 0.000001) return null;
  return { latitude: lat, longitude: lon };
}

export function fallbackDistrictCoordinates(district: CyprusDistrict): Coordinates {
  return DISTRICT_CENTER_COORDS[district];
}

/**
 * Distance for finder "Doctor near me" labels/sorting.
 *
 * Product rule: never invent distance from a district centre. Only return a
 * distance when the listing has real coordinates in Cyprus. Listings without
 * lat/lon (e.g. GeSY imports pending Places) must show no "X km away".
 */
export function computeFinderDistanceKm(
  userCoords: Coordinates | null | undefined,
  latitude: unknown,
  longitude: unknown,
): number | null {
  if (!userCoords) return null;
  const exactCoords = parseOptionalCoordinates(latitude, longitude);
  if (!exactCoords) return null;
  if (!isLikelyCyprusCoordinates(exactCoords)) return null;
  return getDistanceKm(userCoords, exactCoords);
}

export function formatDistanceAway(distanceKm: number): string {
  if (!Number.isFinite(distanceKm)) return "";
  if (distanceKm < 1) {
    return `📍 ${Math.max(1, Math.round(distanceKm * 1000))}m away`;
  }
  return `📍 ${distanceKm.toFixed(1)} km away`;
}

/** Browser GPS with a large accuracy radius should not look like a precise pin. */
export const NEAR_ME_APPROX_ACCURACY_M = 1000;

export function isApproximateNearMeAccuracy(accuracyMeters: number | null | undefined): boolean {
  if (typeof accuracyMeters !== "number" || !Number.isFinite(accuracyMeters)) return false;
  return accuracyMeters >= NEAR_ME_APPROX_ACCURACY_M;
}

export function parseFinderNearMeQuery(searchParams: {
  lat?: string;
  lon?: string;
  acc?: string;
} | null | undefined): { coords: Coordinates; accuracyMeters: number | null } | null {
  const coords = parseOptionalCoordinates(
    Number(String(searchParams?.lat ?? "").trim()),
    Number(String(searchParams?.lon ?? "").trim()),
  );
  if (!coords) return null;
  const accRaw = String(searchParams?.acc ?? "").trim();
  const accuracyMeters = accRaw ? Number(accRaw) : null;
  return {
    coords,
    accuracyMeters:
      typeof accuracyMeters === "number" && Number.isFinite(accuracyMeters) && accuracyMeters > 0
        ? accuracyMeters
        : null,
  };
}

export type FinderNearMeCoords = Coordinates & { accuracyMeters?: number | null };

export function appendFinderNearMeParams(
  params: URLSearchParams,
  coords: FinderNearMeCoords,
): void {
  params.set("lat", String(coords.latitude));
  params.set("lon", String(coords.longitude));
  const acc = coords.accuracyMeters;
  if (typeof acc === "number" && Number.isFinite(acc) && acc > 0) {
    params.set("acc", String(Math.round(acc)));
  }
}

export function formatApproxDistanceAway(distanceKm: number): string {
  if (!Number.isFinite(distanceKm)) return "";
  if (distanceKm < 1) {
    return `📍 ~${Math.max(1, Math.round(distanceKm * 1000))}m away (approx.)`;
  }
  return `📍 ~${distanceKm.toFixed(1)} km away (approx.)`;
}

export function isLikelyCyprusCoordinates(coords: Coordinates): boolean {
  return (
    coords.latitude >= 34.3 &&
    coords.latitude <= 35.9 &&
    coords.longitude >= 32.1 &&
    coords.longitude <= 34.9
  );
}
