import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  GOOGLE_ADS_CONVERSION_CALL_TO_BOOK,
  GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING,
  GOOGLE_ADS_ID,
  googleAdsCallToBookSendTo,
  googleAdsRequestOnlineBookingSendTo,
  googleAdsTagId,
  reportGoogleAdsConversion,
} from "../../lib/google-ads";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type GtagArgs = unknown[];
type FakeLocation = { href: string };
type FakeWindow = {
  gtag?: (...args: GtagArgs) => void;
  location: FakeLocation;
  setTimeout: (handler: () => void, timeout?: number) => number;
};

const originalWindow = (globalThis as { window?: unknown }).window;
const originalAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalCallToBook = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CALL_TO_BOOK;
const originalRequest = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING;

function restoreEnv() {
  if (originalAdsId === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  else process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = originalAdsId;
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
  if (originalCallToBook === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CALL_TO_BOOK;
  else process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CALL_TO_BOOK = originalCallToBook;
  if (originalRequest === undefined) {
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING;
  } else {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING = originalRequest;
  }
}

function installFakeWindow(gtag?: FakeWindow["gtag"]): FakeWindow {
  const fake: FakeWindow = {
    gtag,
    location: { href: "https://example.test/" },
    setTimeout: () => 0,
  };
  (globalThis as { window: FakeWindow }).window = fake;
  return fake;
}

afterEach(() => {
  restoreEnv();
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window: unknown }).window = originalWindow;
  }
});

describe("googleAdsTagId", () => {
  it("loads the default Ads ID on Vercel production", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    process.env.VERCEL_ENV = "production";
    assert.equal(googleAdsTagId(), GOOGLE_ADS_ID);
  });

  it("does not load the tag outside production unless overridden", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    delete process.env.VERCEL_ENV;
    assert.equal(googleAdsTagId(), null);
  });

  it("can disable the production tag with NEXT_PUBLIC_GOOGLE_ADS_ID=off", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "off";
    assert.equal(googleAdsTagId(), null);
  });

  it("uses an explicit Ads ID override in any environment", () => {
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-999";
    assert.equal(googleAdsTagId(), "AW-999");
  });
});

describe("Google Ads conversion send_to", () => {
  it("keeps Call to Book and Request Online Booking on distinct labels", () => {
    assert.notEqual(GOOGLE_ADS_CONVERSION_CALL_TO_BOOK, GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING);
    assert.equal(googleAdsCallToBookSendTo(), GOOGLE_ADS_CONVERSION_CALL_TO_BOOK);
    assert.equal(googleAdsRequestOnlineBookingSendTo(), GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING);
  });
});

describe("reportGoogleAdsConversion", () => {
  it("sends a parameterized conversion event instead of a hard-coded gtag_report_conversion", () => {
    const calls: GtagArgs[] = [];
    installFakeWindow((...args) => {
      calls.push(args);
    });

    const returned = reportGoogleAdsConversion(GOOGLE_ADS_CONVERSION_CALL_TO_BOOK, "tel:+35799123456");
    assert.equal(returned, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.[0], "event");
    assert.equal(calls[0]?.[1], "conversion");
    const payload = calls[0]?.[2] as { send_to?: string; event_callback?: () => void };
    assert.equal(payload.send_to, GOOGLE_ADS_CONVERSION_CALL_TO_BOOK);
    assert.equal(typeof payload.event_callback, "function");
  });

  it("navigates to the tel: URL after the conversion callback", () => {
    let callback: (() => void) | undefined;
    const fake = installFakeWindow((...args) => {
      const payload = args[2] as { event_callback?: () => void };
      callback = payload.event_callback;
    });

    reportGoogleAdsConversion(GOOGLE_ADS_CONVERSION_CALL_TO_BOOK, "tel:+35799123456");
    assert.equal(fake.location.href, "https://example.test/");
    callback?.();
    assert.equal(fake.location.href, "tel:+35799123456");
  });

  it("opens the tel: URL immediately when gtag is missing", () => {
    const fake = installFakeWindow();
    reportGoogleAdsConversion(GOOGLE_ADS_CONVERSION_CALL_TO_BOOK, "tel:+35799123456");
    assert.equal(fake.location.href, "tel:+35799123456");
  });

  it("does not navigate when reporting a same-page conversion", () => {
    const fake = installFakeWindow(() => undefined);
    reportGoogleAdsConversion(GOOGLE_ADS_CONVERSION_REQUEST_ONLINE_BOOKING);
    assert.equal(fake.location.href, "https://example.test/");
  });
});

describe("Google Ads wiring", () => {
  it("loads a single Google tag from the root layout", () => {
    const source = fs.readFileSync(path.join(repoRoot, "app/layout.tsx"), "utf8");
    assert.equal(source.includes("GoogleAdsTag"), true);
    const tagSource = fs.readFileSync(
      path.join(repoRoot, "components/analytics/GoogleAdsTag.tsx"),
      "utf8",
    );
    assert.equal(tagSource.includes("gtag/js?id="), true);
    assert.equal(tagSource.includes("gtag('config'"), true);
    assert.equal(tagSource.includes("googleAdsConsentDefaultInlineScript"), true);
    assert.equal(tagSource.includes("gtag_report_conversion"), false);
  });

  it("fires Call to Book on the revealed tel: link, not Show phone", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "components/finder/RevealPhoneButton.tsx"),
      "utf8",
    );
    assert.equal(source.includes("reportGoogleAdsConversion"), true);
    assert.equal(source.includes("googleAdsCallToBookSendTo"), true);
    assert.equal(source.includes('variant === "call-to-book" ? handleCallToBookClick'), true);
  });

  it("fires Request Online Booking after a new vote on finder and professional profile", () => {
    const hook = fs.readFileSync(
      path.join(repoRoot, "components/finder/useManualBookingRequestFeedback.tsx"),
      "utf8",
    );
    assert.equal(hook.includes("reportGoogleAdsConversion"), true);
    assert.equal(hook.includes("googleAdsRequestOnlineBookingSendTo"), true);
    assert.equal(hook.includes("!result.duplicate"), true);

    const landing = fs.readFileSync(
      path.join(repoRoot, "components/finder/ManualDirectoryLandingCard.tsx"),
      "utf8",
    );
    assert.equal(landing.includes("FinderResultsAvailabilityShell"), true);
    assert.equal(landing.includes('source: "professional_profile_page"'), true);
  });
});
