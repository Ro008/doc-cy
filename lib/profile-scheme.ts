/**
 * Light / dark on the public profile. Every profile opens in light; anyone can switch
 * with the Light/Dark control, and the choice is kept in a small first-party cookie
 * (a preference the visitor asked for, no tracking). The server reads it, so the page
 * is painted in the right mode from the first byte, with no flash.
 */

export type ProfileScheme = "light" | "dark";

export const PROFILE_SCHEME_COOKIE = "doccy_profile_scheme";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function parseProfileScheme(value: string | null | undefined): ProfileScheme {
  return typeof value === "string" && value.trim().toLowerCase() === "dark" ? "dark" : "light";
}

/** `document.cookie` value that remembers the choice on every profile for a year. */
export function profileSchemeCookie(scheme: ProfileScheme): string {
  return `${PROFILE_SCHEME_COOKIE}=${scheme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
