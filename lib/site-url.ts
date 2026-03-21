/**
 * Public site base URL for links, QR codes, and emails.
 * Set NEXT_PUBLIC_SITE_URL in .env.local (e.g. http://localhost:3000 for local QR tests).
 */
export function getPublicBookingBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://www.mydoccy.com";
}
