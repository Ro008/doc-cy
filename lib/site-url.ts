/**
 * Public site base URL for links, QR codes, and emails.
 * Set NEXT_PUBLIC_SITE_URL in .env.local (e.g. http://localhost:3000 for local QR tests).
 */
export function getPublicBookingBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://www.mydoccy.com";
}

/** Login URL that returns to a doctor dashboard path after sign-in. */
export function getDoctorLoginUrl(nextPath = "/agenda", baseUrl?: string): string {
  const base = (baseUrl?.trim() || getPublicBookingBaseUrl()).replace(/\/$/, "");
  const url = new URL("/login", base);
  url.searchParams.set("next", nextPath);
  return url.toString();
}
