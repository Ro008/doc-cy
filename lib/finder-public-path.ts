import type { CyprusDistrict } from "@/lib/cyprus-districts";
import { districtToSlug, specialtyToSlug } from "@/lib/finder-seo";

/** Internal App Router base where finder pages still live. */
export const FINDER_INTERNAL_BASE = "/finder";

/** Healthcare-professional sales / join marketing page (former homepage). */
export const FOR_PROFESSIONALS_PATH = "/for-professionals";

/** First path segments that are finder district filters (public URLs). */
export const FINDER_DISTRICT_PATH_SLUGS = new Set([
  "nicosia",
  "limassol",
  "paphos",
  "larnaca",
  "famagusta",
  "all",
]);

/**
 * Canonical public URL for finder results (no `/finder` prefix).
 * Examples: `/`, `/larnaca`, `/larnaca/dentistry`, `/all/gynecology`
 */
export function finderResultsPath(
  district?: string | null,
  specialty?: string | null,
): string {
  const districtRaw = String(district ?? "").trim();
  const specialtyRaw = String(specialty ?? "").trim();

  if (!districtRaw && !specialtyRaw) return "/";

  let districtSlug = "all";
  if (districtRaw) {
    const lower = districtRaw.toLowerCase();
    if (FINDER_DISTRICT_PATH_SLUGS.has(lower)) {
      districtSlug = lower;
    } else {
      districtSlug = districtToSlug(districtRaw as CyprusDistrict) || "all";
    }
  }

  if (!specialtyRaw) {
    return `/${districtSlug}`;
  }

  return `/${districtSlug}/${specialtyToSlug(specialtyRaw)}`;
}

/** `/finder` filter URLs that should 301 to the public (unprefixed) path. */
export function isLegacyFinderFilterPath(pathname: string): boolean {
  if (pathname === FINDER_INTERNAL_BASE) return true;
  if (!pathname.startsWith(`${FINDER_INTERNAL_BASE}/`)) return false;
  const first = pathname.slice(FINDER_INTERNAL_BASE.length + 1).split("/")[0] ?? "";
  // Keep manual professional landings on /finder/professional/...
  if (first === "professional" || first === "clinic") return false;
  return true;
}

export function legacyFinderFilterToPublicPath(pathname: string): string {
  if (pathname === FINDER_INTERNAL_BASE) return "/";
  if (!pathname.startsWith(`${FINDER_INTERNAL_BASE}/`)) return pathname;
  const rest = pathname.slice(FINDER_INTERNAL_BASE.length);
  return rest || "/";
}

/** Browser path that should be rewritten to `/finder/...` internally. */
export function isPublicFinderResultsPath(pathname: string): boolean {
  if (pathname === "/") return true;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || segments.length > 2) return false;
  return FINDER_DISTRICT_PATH_SLUGS.has(segments[0] ?? "");
}

/**
 * Paths that middleware used to rewrite to `/finder/...`.
 * District URLs are now real App Router pages (`app/larnaca`, `app/all`, …)
 * so client navigation works. Kept as a predicate that always returns false.
 */
export function needsMiddlewareFinderRewrite(_pathname: string): boolean {
  return false;
}

export function publicFinderPathToInternal(pathname: string): string {
  if (pathname === "/") return FINDER_INTERNAL_BASE;
  return `${FINDER_INTERNAL_BASE}${pathname}`;
}
