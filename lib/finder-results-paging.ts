import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

/**
 * How many finder/clinic cards to render per "page" (Show more multiplies this).
 * 12 matches typical healthcare directory first pages (Zocdoc ~10) and fits
 * a patient shortlist without dumping 30 tall calendar cards on first paint.
 */
export const FINDER_RESULTS_PAGE_SIZE = 12;

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

/** CI/QA only: keep freshly created test doctors on the first page of 12. */
export function pinRegisteredTestProfilesFirst<T extends {
  kind: "registered" | "manual";
  row: { isTestProfile?: boolean };
}>(results: T[], enabled: boolean): void {
  if (!enabled) return;
  results.sort((a, b) => {
    const aTest = a.kind === "registered" && Boolean(a.row.isTestProfile);
    const bTest = b.kind === "registered" && Boolean(b.row.isTestProfile);
    if (aTest === bTest) return 0;
    return aTest ? -1 : 1;
  });
}
