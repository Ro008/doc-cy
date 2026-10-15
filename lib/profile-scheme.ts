/**
 * Light / dark on the public site (Finder, Clinics, profiles): one choice for every page
 * (user, 2026-10-13). A visitor without a choice gets the founders' default
 * (`app_settings.public_default_scheme`, light to start). Anyone can switch
 * with the Light/Dark control, and the choice is kept in a small first-party cookie
 * (a preference the visitor asked for, no tracking). The server reads it, so the page
 * is painted in the right mode from the first byte, with no flash.
 */

export type ProfileScheme = "light" | "dark";

export const PROFILE_SCHEME_COOKIE = "doccy_scheme";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function parseProfileScheme(value: string | null | undefined): ProfileScheme {
  return typeof value === "string" && value.trim().toLowerCase() === "dark" ? "dark" : "light";
}

/** `document.cookie` value that remembers the choice on every profile for a year. */
export function profileSchemeCookie(scheme: ProfileScheme): string {
  return `${PROFILE_SCHEME_COOKIE}=${scheme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/**
 * The visitor's own choice from the cookie: exactly light or dark, or null when they have
 * not picked one (then the founders' default applies).
 */
export function readSchemeCookie(value: string | null | undefined): ProfileScheme | null {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v === "light" || v === "dark" ? v : null;
}

/** One choice for the whole public site: the visitor's own, else the default. */
export function resolveSiteScheme(
  cookieValue: string | null | undefined,
  fallback: ProfileScheme,
): ProfileScheme {
  return readSchemeCookie(cookieValue) ?? fallback;
}

/** `app_settings.public_default_scheme` (a JSON string); null when missing or invalid. */
export function parseDefaultScheme(value: unknown): ProfileScheme | null {
  return value === "light" || value === "dark" ? value : null;
}
