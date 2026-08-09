import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

/**
 * How many finder cards to render per "page" (Show more multiplies this).
 * Kept modest so calendar client islands stay cheap to hydrate.
 */
export const FINDER_RESULTS_PAGE_SIZE = 30;

/** Max ?page= when browsing without district/specialty/name/near-me. */
export const FINDER_RESULTS_MAX_PAGE_UNFILTERED = 2;

/** Max ?page= when at least one list filter is active. */
export const FINDER_RESULTS_MAX_PAGE_FILTERED = 20;

/** Escape `%` / `_` / `\` for PostgREST `ilike` patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Raw specialty strings that should match a finder specialty filter in SQL.
 * Mirrors harmonize groups so Pediatric Dentistry etc. match "Dentistry".
 */
const SPECIALTY_DB_VARIANTS: Record<string, readonly string[]> = {
  Gynecology: [
    "Gynecology",
    "Gynecologic Oncology",
    "Obstetrics/Gynecology",
    "Obstetrics / Gynecology",
    "Obstetrics and Gynecology",
  ],
  "Physiotherapy & Rehabilitation": [
    "Physiotherapy",
    "Physiotherapy & Rehabilitation",
    "Physiotherapy and Rehabilitation",
  ],
  Psychology: ["Psychology", "Psychotherapy"],
  Dentistry: [
    "Dentistry",
    "Pediatric Dentistry",
    "Cosmetic Dentistry",
    "Orthodontics",
    "Endodontics",
    "Oral Surgery",
  ],
};

export function finderSpecialtyDbMatchValues(activeSpecialty: string): string[] {
  const trimmed = String(activeSpecialty ?? "").trim();
  if (!trimmed) return [];
  const canon = harmonizeFinderSpecialtyLabel(trimmed) || trimmed;
  const variants = SPECIALTY_DB_VARIANTS[canon] ?? [canon];
  return Array.from(new Set([trimmed, canon, ...variants].map((v) => v.trim()).filter(Boolean)));
}

export function parseFinderResultsPage(
  raw: string | string[] | undefined,
  options?: { hasListFilter?: boolean },
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(String(value ?? "1").trim());
  if (!Number.isFinite(n) || n < 1) return 1;
  const maxPage = options?.hasListFilter
    ? FINDER_RESULTS_MAX_PAGE_FILTERED
    : FINDER_RESULTS_MAX_PAGE_UNFILTERED;
  return Math.min(Math.floor(n), maxPage);
}

export function buildFinderResultsPageHref(params: {
  finderPath: string;
  name?: string;
  lat?: string | null;
  lon?: string | null;
  page: number;
}): string {
  const qs = new URLSearchParams();
  const name = params.name?.trim();
  if (name) qs.set("name", name);
  if (params.lat) qs.set("lat", params.lat);
  if (params.lon) qs.set("lon", params.lon);
  if (params.page > 1) qs.set("page", String(params.page));
  const query = qs.toString();
  return query ? `${params.finderPath}?${query}` : params.finderPath;
}
