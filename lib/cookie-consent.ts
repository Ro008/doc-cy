/**
 * First-party ads cookie preference + Google Consent Mode v2 helpers.
 * Essential product cookies (login, traffic session) are not gated here.
 */

export const ADS_CONSENT_COOKIE = "doccy-ads-consent";
export const ADS_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const DOCCY_OPEN_COOKIE_PREFERENCES_EVENT = "doccy:open-cookie-preferences";

export type AdsConsentChoice = "granted" | "denied";

export type GoogleAdsConsentState = {
  ad_storage: AdsConsentChoice;
  ad_user_data: AdsConsentChoice;
  ad_personalization: AdsConsentChoice;
  analytics_storage: "denied";
};

export function parseAdsConsentCookie(cookieSource: string): AdsConsentChoice | null {
  const parts = String(cookieSource ?? "").split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== ADS_CONSENT_COOKIE) continue;
    const value = trimmed.slice(eq + 1).trim();
    if (value === "granted" || value === "denied") return value;
    return null;
  }
  return null;
}

export function readAdsConsentFromDocumentCookie(): AdsConsentChoice | null {
  if (typeof document === "undefined") return null;
  return parseAdsConsentCookie(document.cookie);
}

export function googleAdsConsentState(choice: AdsConsentChoice): GoogleAdsConsentState {
  const ads = choice === "granted" ? "granted" : "denied";
  return {
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
    analytics_storage: "denied",
  };
}

export function adsConsentCookieWriteValue(choice: AdsConsentChoice): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? ";Secure" : "";
  return `${ADS_CONSENT_COOKIE}=${choice};Path=/;Max-Age=${ADS_CONSENT_MAX_AGE_SECONDS};SameSite=Lax${secure}`;
}

export function writeAdsConsentCookie(choice: AdsConsentChoice): void {
  if (typeof document === "undefined") return;
  document.cookie = adsConsentCookieWriteValue(choice);
}

export function applyGoogleAdsConsent(choice: AdsConsentChoice): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer!.push(arguments);
    };
  }
  window.gtag("consent", "update", googleAdsConsentState(choice));
}

/**
 * Runs before gtag.js so Consent Mode defaults to denied unless the visitor
 * already accepted ads cookies.
 */
export function googleAdsConsentDefaultInlineScript(): string {
  const cookieName = JSON.stringify(ADS_CONSENT_COOKIE);
  const denied = JSON.stringify(googleAdsConsentState("denied"));
  const granted = JSON.stringify(googleAdsConsentState("granted"));
  return `(function(){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;var granted=false;try{var parts=document.cookie.split(";");for(var i=0;i<parts.length;i++){var c=parts[i].replace(/^\\s+/,"");if(c===${cookieName}+"=granted"){granted=true;break;}}}catch(e){}gtag("consent","default",Object.assign(${denied},{wait_for_update:500}));if(granted)gtag("consent","update",${granted});})();`;
}

let pendingOpenCookiePreferences = false;

export function emitOpenCookiePreferences(): void {
  pendingOpenCookiePreferences = true;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DOCCY_OPEN_COOKIE_PREFERENCES_EVENT));
}

export function consumePendingOpenCookiePreferences(): boolean {
  const next = pendingOpenCookiePreferences;
  pendingOpenCookiePreferences = false;
  return next;
}

export function subscribeOpenCookiePreferences(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onEvent = () => {
    pendingOpenCookiePreferences = false;
    handler();
  };

  window.addEventListener(DOCCY_OPEN_COOKIE_PREFERENCES_EVENT, onEvent);
  if (consumePendingOpenCookiePreferences()) handler();

  return () => {
    window.removeEventListener(DOCCY_OPEN_COOKIE_PREFERENCES_EVENT, onEvent);
  };
}
