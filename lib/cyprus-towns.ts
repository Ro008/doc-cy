import townsData from "./cyprus-towns-data.json";

export type AddressComponentLike = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

const TOWN_COMPONENT_TYPES = new Set([
  "locality",
  "postal_town",
  "administrative_area_level_3",
  "sublocality",
  "sublocality_level_1",
]);

const CANONICAL_TOWNS = (townsData.towns as string[]).map((town) => town.trim()).filter(Boolean);

const TOWN_BY_KEY = new Map<string, string>();
for (const town of CANONICAL_TOWNS) {
  TOWN_BY_KEY.set(normalizeTownKey(town), town);
}
for (const [alias, canonical] of Object.entries(townsData.aliases as Record<string, string>)) {
  const resolved = TOWN_BY_KEY.get(normalizeTownKey(canonical)) ?? canonical;
  TOWN_BY_KEY.set(normalizeTownKey(alias), resolved);
}

const TOWN_KEYS_LONGEST_FIRST = [...TOWN_BY_KEY.keys()].sort((a, b) => b.length - a.length);

function normalizeTownKey(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeCyprusTown(value: string | null | undefined): string | null {
  const key = normalizeTownKey(String(value ?? ""));
  if (!key) return null;
  const direct = TOWN_BY_KEY.get(key);
  if (direct) return direct;
  const withoutPostcode = key.replace(/\b\d{4}\b/g, " ").replace(/\s+/g, " ").trim();
  if (!withoutPostcode || withoutPostcode === key) return null;
  return TOWN_BY_KEY.get(withoutPostcode) ?? null;
}

export function cyprusTowns(): readonly string[] {
  return CANONICAL_TOWNS;
}

function townFromAddressComponents(
  components: readonly AddressComponentLike[] | null | undefined,
): string | null {
  if (!components?.length) return null;
  const ranked = [...components].sort((a, b) => {
    const aLocality = a.types?.includes("locality") ? 0 : 1;
    const bLocality = b.types?.includes("locality") ? 0 : 1;
    return aLocality - bLocality;
  });
  for (const component of ranked) {
    const types = component.types ?? [];
    if (!types.some((type) => TOWN_COMPONENT_TYPES.has(type))) continue;
    const fromLong = canonicalizeCyprusTown(component.long_name);
    if (fromLong) return fromLong;
    const fromShort = canonicalizeCyprusTown(component.short_name);
    if (fromShort) return fromShort;
  }
  return null;
}

function townFromAddressText(address: string | null | undefined): string | null {
  const text = String(address ?? "").trim();
  if (!text) return null;
  const segments = text.split(",").map((part) => canonicalizeCyprusTown(part));
  for (const segment of segments) {
    if (segment) return segment;
  }
  const normalized = ` ${normalizeTownKey(text)} `;
  for (const key of TOWN_KEYS_LONGEST_FIRST) {
    if (!key) continue;
    if (normalized.includes(` ${key} `)) return TOWN_BY_KEY.get(key) ?? null;
  }
  return null;
}

/** Resolve a Cyprus town from Google Places components, then address text. */
export function inferCyprusTownFromClinic(input: {
  town?: string | null;
  address?: string | null;
  addressComponents?: readonly AddressComponentLike[] | null;
}): string | null {
  const explicit = canonicalizeCyprusTown(input.town);
  if (explicit) return explicit;
  return (
    townFromAddressComponents(input.addressComponents) ??
    townFromAddressText(input.address)
  );
}
