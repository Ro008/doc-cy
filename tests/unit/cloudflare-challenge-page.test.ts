import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
