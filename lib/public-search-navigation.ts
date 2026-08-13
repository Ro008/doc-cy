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
