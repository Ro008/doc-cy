export const CLINIC_ADDRESS =
  "Evangelismos Private Hospital, 87 Vasileos Constantinou Ave, Paphos";

export const MAPS_URL = "https://maps.google.com/?q=Evangelismos+Private+Hospital+Paphos";

export function buildMapsUrlFromAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return MAPS_URL;
  return `https://maps.google.com/?q=${encodeURIComponent(trimmed)}`;
}

