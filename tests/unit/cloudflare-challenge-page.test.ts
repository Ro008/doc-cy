import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  cloudflareChallengeAction,
  isCloudflareChallengePage,
} from "../prod/helpers/cloudflareChallengePage";

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

describe("cloudflareChallengeAction", () => {
  it("skips only when the run opts in (edge lane with the Vercel origin as the real check)", () => {
    assert.equal(cloudflareChallengeAction({ PLAYWRIGHT_CLOUDFLARE_CHALLENGE: "skip" }), "skip");
  });

  it("fails by default, so origin, preview and local runs stay strict", () => {
    assert.equal(cloudflareChallengeAction({}), "fail");
    assert.equal(cloudflareChallengeAction({ PLAYWRIGHT_CLOUDFLARE_CHALLENGE: "fail" }), "fail");
    assert.equal(cloudflareChallengeAction({ PLAYWRIGHT_CLOUDFLARE_CHALLENGE: "yes" }), "fail");
  });
});

describe("prod nightly Cloudflare harness", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  it("does not set custom Bot Fight Mode headers on every mydoccy.com request", () => {
    const src = fs.readFileSync(path.join(repoRoot, "playwright.config.ts"), "utf8");
    assert.doesNotMatch(
      src,
      /TRAFFIC_LOG_SUPPRESS_HEADER|x-doccy-suppress-traffic-log/,
      "Global custom headers on production are a Bot Fight Mode signal.",
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

  it("skips Cloudflare challenges on the edge lane only, and only when origin is the real check", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, ".github/workflows/prod-critical-smoke.yml"),
      "utf8",
    );
    const edge = src.slice(src.indexOf("  prod-smoke-edge:"), src.indexOf("  prod-smoke-origin:"));
    const origin = src.slice(src.indexOf("  prod-smoke-origin:"));
    assert.match(
      edge,
      /PLAYWRIGHT_CLOUDFLARE_CHALLENGE: \$\{\{ needs.smoke-targets.outputs.origin_enabled == 'true' && 'skip' \|\| 'fail' \}\}/,
    );
    assert.doesNotMatch(origin, /PLAYWRIGHT_CLOUDFLARE_CHALLENGE/);
  });

  it("dismisses the cookie bar via shared prod smoke helpers", () => {
    const harness = fs.readFileSync(
      path.join(repoRoot, "tests/prod/helpers/assertNoCloudflareChallenge.ts"),
      "utf8",
    );
    const booking = fs.readFileSync(
      path.join(repoRoot, "tests/prod/prod_appointment_booking_flow.spec.ts"),
      "utf8",
    );
    assert.match(harness, /dismissCookieConsentIfPresent/);
    assert.match(booking, /@nightly-prod/);
  });
});
