import { isCyprusDistrict, type CyprusDistrict } from "@/lib/cyprus-districts";
import townsData from "./cyprus-towns-data.json";

export type AddressComponentLike = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

export type CyprusTownOption = {
  name: string;
  district: CyprusDistrict;
};

export const FINDER_TOWN_MIN_QUERY_LENGTH = 3;
const FINDER_TOWN_SUGGESTION_LIMIT = 8;

const TOWN_COMPONENT_TYPES = new Set([
  "locality",
  "postal_town",
  "administrative_area_level_3",
  "sublocality",
  "sublocality_level_1",
]);

const TOWN_ENTRIES: CyprusTownOption[] = (townsData.entries as Array<{ name: string; district: string }>)
  .map((entry) => ({
    name: String(entry.name ?? "").trim(),
    district: String(entry.district ?? "").trim(),
  }))
  .filter((entry): entry is CyprusTownOption => Boolean(entry.name) && isCyprusDistrict(entry.district));

const CANONICAL_TOWNS = TOWN_ENTRIES.map((entry) => entry.name);

const TOWN_BY_KEY = new Map<string, string>();
const DISTRICT_BY_TOWN_KEY = new Map<string, CyprusDistrict>();
for (const entry of TOWN_ENTRIES) {
  const key = normalizeTownKey(entry.name);
  TOWN_BY_KEY.set(key, entry.name);
  DISTRICT_BY_TOWN_KEY.set(key, entry.district);
}
for (const [alias, canonical] of Object.entries(townsData.aliases as Record<string, string>)) {
  const resolved = TOWN_BY_KEY.get(normalizeTownKey(canonical)) ?? canonical;
  const resolvedKey = normalizeTownKey(resolved);
  TOWN_BY_KEY.set(normalizeTownKey(alias), resolved);
  const district = DISTRICT_BY_TOWN_KEY.get(resolvedKey);
  if (district) DISTRICT_BY_TOWN_KEY.set(normalizeTownKey(alias), district);
}

const TOWN_KEYS_LONGEST_FIRST = [...TOWN_BY_KEY.keys()].sort((a, b) => b.length - a.length);

export function normalizeTownKey(value: string): string {
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

export function cyprusTownEntries(district?: string | null): readonly CyprusTownOption[] {
  const districtLabel = String(district ?? "").trim();
  if (!districtLabel || !isCyprusDistrict(districtLabel)) return TOWN_ENTRIES;
  return TOWN_ENTRIES.filter((entry) => entry.district === districtLabel);
}

export function districtForTown(town: string | null | undefined): CyprusDistrict | null {
  const canonical = canonicalizeCyprusTown(town);
  if (!canonical) return null;
  return DISTRICT_BY_TOWN_KEY.get(normalizeTownKey(canonical)) ?? null;
}

export function townToSlug(town: string | null | undefined): string {
  const canonical = canonicalizeCyprusTown(town);
  if (!canonical) return "";
  return normalizeTownKey(canonical).replace(/\s+/g, "-");
}

export function slugToTown(slug: string | null | undefined): string | null {
  return canonicalizeCyprusTown(String(slug ?? "").replace(/-/g, " "));
}

export function resolveFinderTownQuery(raw: string | null | undefined): string | null {
  return slugToTown(raw) ?? canonicalizeCyprusTown(raw);
}

/**
 * Finder URL rules: unknown/mismatched town is dropped; a valid town fills district
 * when the path has none. `/limassol?town=tala` keeps Limassol and drops Tala.
 */
export function reconcileFinderTownAndDistrict(input: {
  town: string | null | undefined;
  district: string;
}): { town: string; district: string } {
  const town = String(input.town ?? "").trim();
  const district = String(input.district ?? "").trim();
  const townDistrict = districtForTown(town);
  if (town && townDistrict) {
    if (!district) return { town, district: townDistrict };
    if (district !== townDistrict) return { town: "", district };
  }
  return { town, district };
}

/** Resolve a typed town on Find: exact match, else the single suggestion, else drop town. */
export function resolveFinderTownSubmit(
  nextDistrict: string,
  nextTownQuery: string,
): { town: string; district: string } {
  const exact = resolveFinderTownQuery(nextTownQuery);
  if (exact) {
    const townDistrict = districtForTown(exact);
    if (nextDistrict && townDistrict && townDistrict !== nextDistrict) {
      return { town: "", district: nextDistrict };
    }
    return { town: exact, district: townDistrict || nextDistrict };
  }
  const unique = suggestFinderTowns(nextTownQuery, nextDistrict || null);
  if (unique.length === 1) {
    return { town: unique[0]!.name, district: unique[0]!.district };
  }
  return { town: "", district: nextDistrict };
}

export function suggestFinderTowns(
  query: string,
  district?: string | null,
  limit = FINDER_TOWN_SUGGESTION_LIMIT,
): CyprusTownOption[] {
  const needle = normalizeTownKey(query);
  if (needle.length < FINDER_TOWN_MIN_QUERY_LENGTH) return [];
  const pool = cyprusTownEntries(district);
  const scored: Array<{ entry: CyprusTownOption; score: number }> = [];
  for (const entry of pool) {
    const key = normalizeTownKey(entry.name);
    if (!key) continue;
    let score = -1;
    if (key === needle) score = 0;
    else if (key.startsWith(needle)) score = 1;
    else if (key.split(" ").some((word) => word.startsWith(needle))) score = 2;
    else if (key.includes(needle)) score = 3;
    if (score < 0) continue;
    scored.push({ entry, score });
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.entry.name.localeCompare(b.entry.name, "en", { sensitivity: "base" });
  });
  const seen = new Set<string>();
  const out: CyprusTownOption[] = [];
  for (const item of scored) {
    if (seen.has(item.entry.name)) continue;
    seen.add(item.entry.name);
    out.push(item.entry);
    if (out.length >= limit) break;
  }
  return out;
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
