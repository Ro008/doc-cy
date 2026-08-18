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
    assert.doesNotMatch(src, /^\s+prod-critical-smoke:/m);
  });
});
