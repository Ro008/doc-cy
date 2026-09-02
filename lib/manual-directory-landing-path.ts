import { routing } from "@/i18n/routing";

/** Legacy public SEO path for unregistered directory listings. 301 to the unified profile URL. */
export const MANUAL_DIRECTORY_LANDING_BASE_PATH = "/finder/professional";

/**
 * Canonical public profile URL for every professional (registered or directory-only).
 * Locale prefix is required (`localePrefix: "always"`) so slugs cannot collide with
 * reserved top-level routes (`/login`, `/larnaca`, …).
 */
export function publicProfessionalProfilePath(
  slug: string,
  locale: string = routing.defaultLocale,
): string {
  const normalized = String(slug ?? "").trim();
  const loc = String(locale ?? "").trim() || routing.defaultLocale;
  return normalized
    ? `/${loc}/${encodeURIComponent(normalized)}`
    : `/${loc}`;
}

/** Same as {@link publicProfessionalProfilePath} — kept for existing call sites. */
export function manualDirectoryLandingPath(
  slug: string,
  locale: string = routing.defaultLocale,
): string {
  return publicProfessionalProfilePath(slug, locale);
}

/** Map `/finder/professional/{slug}` → canonical `/{locale}/{slug}`. */
export function legacyManualDirectoryLandingToPublicPath(
  pathname: string,
  locale: string = routing.defaultLocale,
): string | null {
  const path = pathname.split("?")[0]?.split("#")[0] || pathname;
  if (path === MANUAL_DIRECTORY_LANDING_BASE_PATH) return `/${locale}`;
  const prefix = `${MANUAL_DIRECTORY_LANDING_BASE_PATH}/`;
  if (!path.startsWith(prefix)) return null;
  const slug = decodeURIComponent(path.slice(prefix.length).split("/")[0] ?? "").trim();
  return slug ? publicProfessionalProfilePath(slug, locale) : null;
}
