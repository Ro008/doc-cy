import Script from "next/script";
import { googleAdsConsentDefaultInlineScript } from "@/lib/cookie-consent";
import { googleAdsTagId } from "@/lib/google-ads";
import { googleAnalyticsMeasurementId } from "@/lib/google-analytics";
import { GoogleAnalyticsRouteTracker } from "@/components/analytics/GoogleAnalyticsRouteTracker";

/** Sitewide Google tag (Ads + GA4). Loaded once from the root layout. */
export function GoogleAdsTag() {
  const adsId = googleAdsTagId();
  const gaId = googleAnalyticsMeasurementId();
  if (!adsId && !gaId) return null;

  const loaderId = adsId || gaId;
  const configLines = [
    adsId ? `gtag('config', ${JSON.stringify(adsId)});` : "",
    gaId ? `gtag('config', ${JSON.stringify(gaId)}, { send_page_view: false });` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: googleAdsConsentDefaultInlineScript() }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loaderId)}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
${configLines}`}
      </Script>
      {gaId ? <GoogleAnalyticsRouteTracker measurementId={gaId} /> : null}
    </>
  );
}
