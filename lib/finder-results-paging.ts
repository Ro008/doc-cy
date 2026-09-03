import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

/**
 * How many finder/clinic cards to render per "page" (Show more multiplies this).
 * 12 matches typical healthcare directory first pages (Zocdoc ~10) and fits
 * a patient shortlist without dumping 30 tall calendar cards on first paint.
 */
export const FINDER_RESULTS_PAGE_SIZE = 12;

/** Max Show more depth without district/specialty/name/near-me. Queries stay bounded by visibleLimit. */
export const FINDER_RESULTS_MAX_PAGE_UNFILTERED = 20;

/** Max Show more depth when at least one list filter is active. */
export const FINDER_RESULTS_MAX_PAGE_FILTERED = 20;

/** Escape `%` / `_` / `\` for PostgREST `ilike` patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Raw specialty strings that should match a finder specialty filter in SQL.
 * Includes GeSY labels plus legacy registration labels bridged by harmonize.
 */
const SPECIALTY_DB_VARIANTS: Record<string, readonly string[]> = {
  Dentist: ["Dentist", "Dentistry", "Pediatric Dentistry", "Cosmetic Dentistry", "Dental"],
  Paediatrics: ["Paediatrics", "Pediatrics", "Paediatric"],
  "Obstetrics - Gynaecology": [
    "Obstetrics - Gynaecology",
    "Gynecology",
    "Gynecologic Oncology",
    "Obstetrics/Gynecology",
    "Obstetrics / Gynecology",
    "Obstetrics and Gynecology",
  ],
  Physiotherapist: [
    "Physiotherapist",
    "Physiotherapy",
    "Physiotherapy & Rehabilitation",
    "Physiotherapy and Rehabilitation",
  ],
  "Clinical Psychologist": ["Clinical Psychologist"],
  Psychology: ["Psychology"],
  "Dermato-Venereology": ["Dermato-Venereology", "Dermatology"],
  Orthopaedics: ["Orthopaedics", "Orthopedics"],
  Otorhinolaryngology: ["Otorhinolaryngology", "ENT"],
  "Respiratory Medicine": ["Respiratory Medicine", "Pulmonology"],
  "Renal Diseases": ["Renal Diseases", "Nephrology"],
  "Clinical Dietitian": ["Clinical Dietitian", "Nutrition & Dietetics"],
  "Personal Doctor": ["Personal Doctor", "General Practice", "Wellness"],
  "Medical Oncology": ["Medical Oncology", "Oncology"],
  Hematology: ["Hematology", "Haematology"],
};

export function finderSpecialtyDbMatchValues(activeSpecialty: string): string[] {
  const trimmed = String(activeSpecialty ?? "").trim();
  if (!trimmed) return [];
  const canon = harmonizeFinderSpecialtyLabel(trimmed) || trimmed;
  const variants = SPECIALTY_DB_VARIANTS[canon] ?? [canon];
  return Array.from(new Set([trimmed, canon, ...variants].map((v) => v.trim()).filter(Boolean)));
}

export function finderResultsMaxPage(hasListFilter?: boolean): number {
  return hasListFilter
    ? FINDER_RESULTS_MAX_PAGE_FILTERED
    : FINDER_RESULTS_MAX_PAGE_UNFILTERED;
}

export function parseFinderResultsPage(
  raw: string | string[] | undefined,
  options?: { hasListFilter?: boolean },
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(String(value ?? "1").trim());
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), finderResultsMaxPage(options?.hasListFilter));
}

/** True when more cards exist and the next Show more step would not be clamped. */
export function hasMoreFinderResults(input: {
  totalCount: number;
  visibleCount: number;
  resultsPage: number;
  hasListFilter?: boolean;
}): boolean {
  return (
    input.totalCount > input.visibleCount &&
    input.resultsPage < finderResultsMaxPage(input.hasListFilter)
  );
}

/** Public search URL for the current filters. Show more depth is not a query param. */
export function buildFinderResultsPageHref(params: {
  finderPath: string;
  name?: string;
  town?: string;
  lat?: string | null;
  lon?: string | null;
  acc?: string | null;
}): string {
  const qs = new URLSearchParams();
  const name = params.name?.trim();
  if (name) qs.set("name", name);
  const town = params.town?.trim();
  if (town) qs.set("town", town);
  if (params.lat) qs.set("lat", params.lat);
  if (params.lon) qs.set("lon", params.lon);
  if (params.acc) qs.set("acc", params.acc);
  const query = qs.toString();
  return query ? `${params.finderPath}?${query}` : params.finderPath;
}

export { buildFinderManualShuffleSeed } from "@/lib/finder-shuffle-seed";

/** CI/QA only: keep freshly created test doctors on the first page of 12. */
export function pinRegisteredTestProfilesFirst<T extends { kind: string; row: object }>(
  results: T[],
  enabled: boolean,
): void {
  if (!enabled) return;
  results.sort((a, b) => {
    const aTest =
      a.kind === "registered" &&
      Boolean((a.row as { isTestProfile?: boolean }).isTestProfile);
    const bTest =
      b.kind === "registered" &&
      Boolean((b.row as { isTestProfile?: boolean }).isTestProfile);
    if (aTest === bTest) return 0;
    return aTest ? -1 : 1;
  });
}

function seedFromString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable Fisher–Yates shuffle (same seed → same order). */
export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const next = [...items];
  const rng = createSeededRng(seedFromString(seed));
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
}

function compareDistanceKmAsc(
  a: { distanceKm?: number | null },
  b: { distanceKm?: number | null },
): number {
  if (a.distanceKm == null && b.distanceKm == null) return 0;
  if (a.distanceKm == null) return 1;
  if (b.distanceKm == null) return -1;
  return a.distanceKm - b.distanceKm;
}

function finderResultHasOnlineBooking<T extends { hasOnlineBooking?: boolean; row?: object }>(
  item: T,
): boolean {
  if (typeof item.hasOnlineBooking === "boolean") return item.hasOnlineBooking;
  return Boolean((item.row as { hasOnlineBooking?: boolean } | undefined)?.hasOnlineBooking);
}

function finderResultIsRegistered<T extends { kind: string; isRegistered?: boolean; row?: object }>(
  item: T,
): boolean {
  if (typeof item.isRegistered === "boolean") return item.isRegistered;
  if (item.kind === "registered") return true;
  return Boolean((item.row as { isRegistered?: boolean } | undefined)?.isRegistered);
}

/** 0 = booking entitlement, 1 = registered without booking, 2 = unregistered directory. */
export function finderResultSortTier<
  T extends {
    kind: string;
    hasOnlineBooking?: boolean;
    isRegistered?: boolean;
    row?: object;
  },
>(item: T): 0 | 1 | 2 {
  if (finderResultHasOnlineBooking(item)) return 0;
  if (finderResultIsRegistered(item)) return 1;
  return 2;
}

function orderUnregisteredByRequestBuckets<T>(
  items: readonly T[],
  shuffleSeed: string,
  getRequestCount: (item: T) => number,
): T[] {
  if (items.length <= 1) return [...items];
  const buckets = new Map<number, T[]>();
  for (const item of items) {
    const count = Math.max(0, Math.floor(getRequestCount(item)));
    const bucket = buckets.get(count);
    if (bucket) bucket.push(item);
    else buckets.set(count, [item]);
  }
  const orderedCounts = Array.from(buckets.keys()).sort((a, b) => b - a);
  const ordered: T[] = [];
  for (const count of orderedCounts) {
    const bucket = buckets.get(count) ?? [];
    ordered.push(
      ...(bucket.length <= 1
        ? bucket
        : shuffleWithSeed(bucket, `${shuffleSeed}|req-${count}`)),
    );
  }
  return ordered;
}

/**
 * Finder ordering:
 * 1. has_online_booking (product entitlement)
 * 2. registered without booking
 * 3. unregistered directory, bucketed by 30-day unique patients (same number as the 🔥 badge)
 *    (highest first; session-seeded shuffle inside a tied count)
 * Near-me: distance within each product tier (overrides request buckets).
 */
export function orderUnifiedFinderResultsPhase1<
  T extends {
    kind: string;
    distanceKm?: number | null;
    hasOnlineBooking?: boolean;
    isRegistered?: boolean;
    row?: object;
  },
>(
  results: readonly T[],
  options: {
    nearMe: boolean;
    /** Prefer `buildFinderManualShuffleSeed` (session seed + list scope). */
    shuffleSeed: string;
    pinTestProfiles?: boolean;
    getUnregisteredRequestCount?: (item: T) => number;
  },
): T[] {
  const tiers: [T[], T[], T[]] = [[], [], []];
  const other: T[] = [];
  for (const row of results) {
    if (row.kind !== "registered" && row.kind !== "manual") {
      other.push(row);
      continue;
    }
    tiers[finderResultSortTier(row)].push(row);
  }

  const requestCount = options.getUnregisteredRequestCount ?? (() => 0);
  const orderedTiers = tiers.map((tier, index) => {
    if (tier.length <= 1) return tier;
    if (options.nearMe) return [...tier].sort(compareDistanceKmAsc);
    if (index === 2) {
      return orderUnregisteredByRequestBuckets(tier, options.shuffleSeed, requestCount);
    }
    return shuffleWithSeed(tier, `${options.shuffleSeed}|tier-${index}`);
  });

  const ordered = [...orderedTiers[0]!, ...orderedTiers[1]!, ...orderedTiers[2]!, ...other];
  pinRegisteredTestProfilesFirst(
    ordered as Array<T & { kind: string; row: object }>,
    Boolean(options.pinTestProfiles),
  );
  return ordered;
}

