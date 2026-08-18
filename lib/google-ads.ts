/**
 * Google Ads (gtag) conversion helpers.
 * Conversion IDs are public (they ship in client JS). Do not paste Google's
 * `gtag_report_conversion` twice — both snippets share that name and would overwrite.
 */

export const GOOGLE_ADS_ID = "AW-18396180836";
export const GOOGLE_ADS_CONVERSION_CALL_TO_BOOK = "AW-18396180836/JhI4CLTawuMcEOTi_cNE";
export const GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING =
  "AW-18396180836/8EO9CNSuzuMcEOTi_cNE";

const DISABLED_ID_VALUES = new Set(["0", "off", "false"]);

function trimmedEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function parseOptionalAdsId(raw: string): string | null {
  if (!raw) return null;
  if (DISABLED_ID_VALUES.has(raw.toLowerCase())) return null;
  return raw;
}

/** Load gtag on production by default; set NEXT_PUBLIC_GOOGLE_ADS_ID to override or disable. */
export function googleAdsTagId(): string | null {
  const override = parseOptionalAdsId(trimmedEnv("NEXT_PUBLIC_GOOGLE_ADS_ID"));
  if (trimmedEnv("NEXT_PUBLIC_GOOGLE_ADS_ID")) return override;
  if (trimmedEnv("VERCEL_ENV").toLowerCase() === "production") return GOOGLE_ADS_ID;
  return null;
}

export function googleAdsCallToBookSendTo(): string {
  return trimmedEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CALL_TO_BOOK") || GOOGLE_ADS_CONVERSION_CALL_TO_BOOK;
}

export function googleAdsRequestOnlineBookingSendTo(): string {
  return (
    trimmedEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING") ||
    GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING
  );
}

const CONVERSION_CALLBACK_TIMEOUT_MS = 2000;

/**
 * Fire a Google Ads conversion. Pass `url` for tel:/http navigations so the hit
 * can send before the browser leaves the page. Returns false (Google's click pattern).
 */
export function reportGoogleAdsConversion(sendTo: string, url?: string): boolean {
  const destination = typeof url === "string" && url.trim() ? url.trim() : undefined;

  const navigate = () => {
    if (!destination || typeof window === "undefined") return;
    window.location.href = destination;
  };

  if (typeof window === "undefined") return false;

  const gtag = window.gtag;
  if (typeof gtag !== "function" || !sendTo.trim()) {
    navigate();
    return false;
  }

  let finished = false;
  const callback = () => {
    if (finished) return;
    finished = true;
    navigate();
  };

  gtag("event", "conversion", {
    send_to: sendTo,
    event_callback: callback,
    event_timeout: CONVERSION_CALLBACK_TIMEOUT_MS,
  });

  if (destination) {
    window.setTimeout(callback, CONVERSION_CALLBACK_TIMEOUT_MS);
  }

  return false;
}
