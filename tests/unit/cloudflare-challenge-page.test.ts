import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isCloudflareChallengePage } from "../prod/helpers/cloudflareChallengePage";

describe("isCloudflareChallengePage", () => {
  it("detects the Bot Fight interstitial title", () => {
    assert.equal(isCloudflareChallengePage("Just a moment...", "<html></html>"), true);
  });

  it("detects challenge markup", () => {
    assert.equal(
      isCloudflareChallengePage(
        "DocCy",
        '<div id="cf-wrapper"><div class="cf-browser-verification">Checking your browser</div></div>',
      ),
      true,
    );
  });

  it("does not flag a normal DocCy page", () => {
    assert.equal(
      isCloudflareChallengePage(
        "Find a health professional in Cyprus | DocCy",
        "<html><body><h1>Find your next health professional in Cyprus</h1></body></html>",
      ),
      false,
    );
  });

  it("does not flag Cloudflare JS detection scripts on a real page", () => {
    assert.equal(
      isCloudflareChallengePage(
        "Find a health professional in Cyprus | DocCy",
        [
          "<html><head>",
          '<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js" defer></script>',
          "</head><body>",
          "<h1>Run a Smarter Practice.</h1>",
          "</body></html>",
        ].join(""),
      ),
      false,
    );
  });
});

describe("prod nightly Cloudflare harness", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  it("does not send the traffic-log suppress header on every mydoccy.com request", () => {
    const src = fs.readFileSync(path.join(repoRoot, "playwright.config.ts"), "utf8");
    assert.match(
      src,
      /trafficLogSuppressSecret && !isProductionSiteUrl\(baseUrl\)/,
      "Global extraHTTPHeaders on production is a Bot Fight Mode signal.",
    );
  });

  it("runs sequential edge then origin nightly jobs", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, ".github/workflows/prod-critical-smoke.yml"),
      "utf8",
    );
    assert.match(src, /prod-smoke-edge:/);
    assert.match(src, /prod-smoke-origin:/);
    assert.match(src, /needs: \[schedule-gate, smoke-targets, prod-smoke-edge\]/);
    assert.match(src, /PLAYWRIGHT_BASE_URL_VERCEL_PROD/);
    assert.match(src, /continue-on-error: \$\{\{ needs.smoke-targets.outputs.origin_enabled == 'true' \}\}/);
    assert.match(src, /How to read this nightly/);
    assert.match(src, /Keep Bot Fight on/);
    assert.doesNotMatch(src, /^\s+prod-critical-smoke:/m);
  });

  it("dismisses the cookie bar and force-clicks clinic address in prod registration smoke", () => {
    const harness = fs.readFileSync(
      path.join(repoRoot, "tests/prod/helpers/assertNoCloudflareChallenge.ts"),
      "utf8",
    );
    const registration = fs.readFileSync(
      path.join(repoRoot, "tests/prod/prod_registration_smoke.spec.ts"),
      "utf8",
    );
    assert.match(harness, /dismissCookieConsentIfPresent/);
    assert.match(registration, /scrollIntoViewIfNeeded/);
    assert.match(registration, /click\(\{ force: true/);
    assert.match(registration, /isExpectedVercelPlacesReferrerGap/);
    assert.match(registration, /probePlacesPredictions/);
    assert.doesNotMatch(
      registration,
      /await expect\(pacItem\)\.toBeVisible/,
      "Origin nightly must classify the Maps referrer split instead of requiring .pac-item on *.vercel.app.",
    );
  });
});
