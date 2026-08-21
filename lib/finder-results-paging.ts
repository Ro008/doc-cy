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
