/**
 * GA4 measurement ID. Do not paste Google's full gtag.js snippet — Ads already
 * loads gtag once. Add a second `gtag('config', 'G-…')` beside the AW config.
 */

export const GOOGLE_ANALYTICS_MEASUREMENT_ID = "G-FE3FCHCR1K";

const DISABLED_ID_VALUES = new Set(["0", "off", "false"]);

function trimmedEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function parseOptionalId(raw: string): string | null {
  if (!raw) return null;
  if (DISABLED_ID_VALUES.has(raw.toLowerCase())) return null;
  return raw;
}

/** Load GA4 on production by default; set NEXT_PUBLIC_GOOGLE_ANALYTICS_ID to override or disable. */
export function googleAnalyticsMeasurementId(): string | null {
  const override = parseOptionalId(trimmedEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID"));
  if (trimmedEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID")) return override;
  if (trimmedEnv("VERCEL_ENV").toLowerCase() === "production") return GOOGLE_ANALYTICS_MEASUREMENT_ID;
  return null;
}
