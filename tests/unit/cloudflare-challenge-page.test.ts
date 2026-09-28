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

  it("checks /register on the Vercel origin only (Bot Fight challenges GitHub there on the edge)", () => {
    const spec = fs.readFileSync(
      path.join(repoRoot, "tests/prod/prod_site_availability.spec.ts"),
      "utf8",
    );
    const action = fs.readFileSync(
      path.join(repoRoot, ".github/actions/prod-nightly-smoke/action.yml"),
      "utf8",
    );
    // /login keeps its edge check; /register is its own test, tagged origin-only.
    assert.match(spec, /test\("login route renders",\s*async/);
    assert.match(spec, /test\(\s*"register route renders",\s*\{ tag: "@origin-only" \}/);
    // The edge run leaves @origin-only tests out entirely, so they are neither red nor gray.
    assert.match(action, /DOC_CY_SMOKE_TARGET: \$\{\{ inputs.target \}\}/);
    assert.match(action, /if \[ "\$\{DOC_CY_SMOKE_TARGET\}" = "edge" \]; then\s+grep_invert=\(--grep-invert @origin-only\)/);
  });
});
