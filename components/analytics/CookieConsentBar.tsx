"use client";

import * as React from "react";
import Link from "next/link";
import {
  applyGoogleAdsConsent,
  readAdsConsentFromDocumentCookie,
  subscribeOpenCookiePreferences,
  writeAdsConsentCookie,
  type AdsConsentChoice,
} from "@/lib/cookie-consent";

type CookieConsentBarProps = {
  /** Auto-open only when the Google tag is actually loaded (production). */
  googleTagEnabled: boolean;
};

export function CookieConsentBar({ googleTagEnabled }: CookieConsentBarProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (googleTagEnabled && !readAdsConsentFromDocumentCookie()) {
      setOpen(true);
    }
    return subscribeOpenCookiePreferences(() => setOpen(true));
  }, [googleTagEnabled]);

  function choose(choice: AdsConsentChoice) {
    writeAdsConsentCookie(choice);
    applyGoogleAdsConsent(choice);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Cookie preferences"
      data-testid="cookie-consent-bar"
      className="fixed inset-x-0 bottom-0 z-[96] border-t border-ink-200 bg-white/95 px-4 py-3 text-ink-800 shadow-[0_-8px_24px_rgba(26,43,60,0.12)] backdrop-blur-sm sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-snug text-ink-700">
          We use Google cookies to measure ads and site usage. You can reject them and still use
          DocCy.{" "}
          <Link
            href="/privacy"
            className="font-semibold text-clinical-700 underline underline-offset-2 hover:text-clinical-600"
          >
            Privacy
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            data-testid="cookie-consent-reject"
            onClick={() => choose("denied")}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 transition hover:border-clinical-300 hover:bg-clinical-50"
          >
            Reject
          </button>
          <button
            type="button"
            data-testid="cookie-consent-accept"
            onClick={() => choose("granted")}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-clinical-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-clinical-400"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
