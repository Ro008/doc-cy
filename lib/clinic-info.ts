import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";

export const CLINIC_ADDRESS =
  "Evangelismos Private Hospital, 87 Vasileos Constantinou Ave, Paphos";

export const MAPS_URL = "https://maps.google.com/?q=Evangelismos+Private+Hospital+Paphos";

export function buildMapsUrlFromAddress(address: string): string {
  const trimmed = stripPlusCodePrefix(address);
  if (!trimmed) return MAPS_URL;
  return `https://maps.google.com/?q=${encodeURIComponent(trimmed)}`;
}

/** Prefer place id, then coordinates, then address text — never a plus-code prefix. */
export function buildMapsUrlFromClinicLocation(input: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
}): string | null {
  const address = stripPlusCodePrefix(String(input.address ?? ""));
  const placeId = String(input.placeId ?? "").trim();
  const lat = input.latitude;
  const lng = input.longitude;

  if (placeId) {
    const query = address || "Clinic";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(placeId)}`;
  }
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  if (address) {
    return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  }
  return null;
}
