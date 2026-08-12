import type { CyprusDistrict } from "@/lib/cyprus-districts";
import { districtToSlug } from "@/lib/finder-seo";
import { FINDER_DISTRICT_PATH_SLUGS } from "@/lib/finder-public-path";

/** Public clinics search (separate from the professionals finder at `/`). */
export const CLINICS_SEARCH_BASE = "/clinics";

/**
 * Canonical public URL for clinic search results.
 * Examples: `/clinics`, `/clinics/paphos`
 */
export function clinicsResultsPath(district?: string | null): string {
  const districtRaw = String(district ?? "").trim();
  if (!districtRaw) return CLINICS_SEARCH_BASE;

  const lower = districtRaw.toLowerCase();
  if (lower === "all") return CLINICS_SEARCH_BASE;

  let districtSlug = "";
  if (FINDER_DISTRICT_PATH_SLUGS.has(lower)) {
    districtSlug = lower;
  } else {
    districtSlug = districtToSlug(districtRaw as CyprusDistrict) || "";
  }

  if (!districtSlug || districtSlug === "all") return CLINICS_SEARCH_BASE;
  return `${CLINICS_SEARCH_BASE}/${districtSlug}`;
}

export function isClinicsSearchPath(pathname: string): boolean {
  if (pathname === CLINICS_SEARCH_BASE || pathname === `${CLINICS_SEARCH_BASE}/`) {
    return true;
  }
  if (!pathname.startsWith(`${CLINICS_SEARCH_BASE}/`)) return false;
  const rest = pathname.slice(CLINICS_SEARCH_BASE.length + 1).split("/").filter(Boolean);
  if (rest.length !== 1) return false;
  return FINDER_DISTRICT_PATH_SLUGS.has(rest[0] ?? "") && rest[0] !== "all";
}
