import { isClinicsSearchPath } from "@/lib/clinics-public-path";
import { isPublicFinderResultsPath } from "@/lib/finder-public-path";
import type { NavigationStartDetail } from "@/lib/doccy-navigation";

export function publicSearchPathname(href: string): string {
  try {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return new URL(href).pathname;
    }
  } catch {
    // ignore
  }
  return href.split("?")[0]?.split("#")[0] || href;
}

/**
 * Full document load is no longer needed for public search URLs.
 * `/`, `/clinics`, and district/specialty paths (`/larnaca`, `/all/dentistry`)
 * are real App Router pages — Next `<Link>` / `router.push` is safe.
 */
export function needsPublicSearchHardNavigation(_href: string): boolean {
  return false;
}

export function isPublicSearchResultsPath(pathname: string): boolean {
  const path = publicSearchPathname(pathname);
  return isPublicFinderResultsPath(path) || isClinicsSearchPath(path);
}

/** Swap the results list for skeletons on filter/switcher taps — not profile opens. */
export function shouldShowFinderResultsSkeleton(
  detail?: NavigationStartDetail | null,
): boolean {
  const reason = detail?.reason;
  if (reason === "profile" || reason === "finder-load-more") return false;
  if (
    reason === "finder-results" ||
    reason === "finder-near-me" ||
    reason === "clinics-near-me"
  ) {
    return true;
  }
  const href = detail?.linkKey;
  if (href) return isPublicSearchResultsPath(href);
  return false;
}

