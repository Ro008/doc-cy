import Script from "next/script";
import { googleAdsConsentDefaultInlineScript } from "@/lib/cookie-consent";
import { googleAdsTagId } from "@/lib/google-ads";

/** Sitewide Google Ads tag. Loaded once from the root layout; conversion events call gtag separately. */
export function GoogleAdsTag() {
  const id = googleAdsTagId();
  if (!id) return null;

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: googleAdsConsentDefaultInlineScript() }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});`}
      </Script>
    </>
  );
}
