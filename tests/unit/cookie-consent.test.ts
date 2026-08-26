import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import {
  ADS_CONSENT_COOKIE,
  consumePendingOpenCookiePreferences,
  emitOpenCookiePreferences,
  googleAdsConsentDefaultInlineScript,
  googleAdsConsentState,
  parseAdsConsentCookie,
} from "../../lib/cookie-consent";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("parseAdsConsentCookie", () => {
  it("reads granted and denied values", () => {
    assert.equal(parseAdsConsentCookie(`${ADS_CONSENT_COOKIE}=granted`), "granted");
    assert.equal(
      parseAdsConsentCookie(`other=1; ${ADS_CONSENT_COOKIE}=denied; theme=light`),
      "denied",
    );
  });

  it("ignores missing or unknown values", () => {
    assert.equal(parseAdsConsentCookie(""), null);
    assert.equal(parseAdsConsentCookie("theme=light"), null);
    assert.equal(parseAdsConsentCookie(`${ADS_CONSENT_COOKIE}=maybe`), null);
  });
});

describe("googleAdsConsentState", () => {
  it("grants analytics_storage together with ads when the visitor accepts", () => {
    assert.equal(googleAdsConsentState("granted").analytics_storage, "granted");
    assert.equal(googleAdsConsentState("denied").analytics_storage, "denied");
  });
});

describe("googleAdsConsentDefaultInlineScript", () => {
  it("defaults Google Ads storage to denied", () => {
    const script = googleAdsConsentDefaultInlineScript();
    assert.equal(script.includes('"ad_storage":"denied"'), true);
    assert.equal(script.includes('"ad_user_data":"denied"'), true);
    assert.equal(script.includes('"ad_personalization":"denied"'), true);
    assert.equal(script.includes('"analytics_storage":"denied"'), true);
    assert.equal(script.includes("wait_for_update"), true);
    assert.equal(script.includes(ADS_CONSENT_COOKIE), true);
  });

  it("updates consent when the first-party cookie is already granted", () => {
    const sandbox: {
      window: unknown;
      document: { cookie: string };
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    } = {
      window: null,
      document: { cookie: `${ADS_CONSENT_COOKIE}=granted` },
    };
    sandbox.window = sandbox;
    vm.runInNewContext(googleAdsConsentDefaultInlineScript(), sandbox);

    const commands = (sandbox.dataLayer ?? []).map((entry) => Array.from(entry as unknown[]));
    assert.equal(commands[0]?.[0], "consent");
    assert.equal(commands[0]?.[1], "default");
    assert.equal((commands[0]?.[2] as { ad_storage?: string }).ad_storage, "denied");
    assert.equal(
      (commands[0]?.[2] as { analytics_storage?: string }).analytics_storage,
      "denied",
    );
    assert.equal(commands[1]?.[0], "consent");
    assert.equal(commands[1]?.[1], "update");
    assert.equal(
      JSON.stringify(commands[1]?.[2]),
      JSON.stringify(googleAdsConsentState("granted")),
    );
    assert.equal(
      (commands[1]?.[2] as { analytics_storage?: string }).analytics_storage,
      "granted",
    );
  });

  it("does not grant ads storage when the cookie is denied", () => {
    const sandbox: {
      window: unknown;
      document: { cookie: string };
      dataLayer?: unknown[];
    } = {
      window: null,
      document: { cookie: `${ADS_CONSENT_COOKIE}=denied` },
    };
    sandbox.window = sandbox;
    vm.runInNewContext(googleAdsConsentDefaultInlineScript(), sandbox);

    const commands = (sandbox.dataLayer ?? []).map((entry) => Array.from(entry as unknown[]));
    assert.equal(commands.length, 1);
    assert.equal(commands[0]?.[1], "default");
  });
});

describe("open cookie preferences pending queue", () => {
  it("keeps a footer click until the lazy bar consumes it", () => {
    consumePendingOpenCookiePreferences();
    emitOpenCookiePreferences();
    assert.equal(consumePendingOpenCookiePreferences(), true);
    assert.equal(consumePendingOpenCookiePreferences(), false);
  });
});

describe("cookie consent wiring", () => {
  it("bootstraps Consent Mode before gtag.js", () => {
    const tagSource = fs.readFileSync(
      path.join(repoRoot, "components/analytics/GoogleAdsTag.tsx"),
      "utf8",
    );
    assert.equal(tagSource.includes("googleAdsConsentDefaultInlineScript"), true);
    const consentIndex = tagSource.indexOf("googleAdsConsentDefaultInlineScript");
    const gtagJsIndex = tagSource.indexOf("gtag/js?id=");
    assert.ok(consentIndex >= 0 && consentIndex < gtagJsIndex);
  });

  it("mounts the cookie bar from the root layout", () => {
    const layout = fs.readFileSync(path.join(repoRoot, "app/layout.tsx"), "utf8");
    assert.equal(layout.includes("CookieConsentBar"), true);
    assert.equal(layout.includes("googleTagEnabled"), true);
  });

  it("prod nightly dismisses the cookie bar before clicking page controls", () => {
    const helper = fs.readFileSync(
      path.join(repoRoot, "tests/prod/helpers/dismissCookieConsent.ts"),
      "utf8",
    );
    const harness = fs.readFileSync(
      path.join(repoRoot, "tests/prod/helpers/assertNoCloudflareChallenge.ts"),
      "utf8",
    );
    assert.equal(helper.includes("cookie-consent-reject"), true);
    assert.equal(harness.includes("dismissCookieConsentIfPresent"), true);
  });
});
