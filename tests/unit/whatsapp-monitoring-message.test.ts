import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildNightlyWhatsAppMessage,
  interpretEdgeVsOrigin,
} from "../../lib/whatsapp-monitoring-message.mjs";

describe("interpretEdgeVsOrigin", () => {
  it("asks to set the origin secret when origin is skipped", () => {
    assert.match(
      interpretEdgeVsOrigin("failure", "skipped"),
      /PLAYWRIGHT_BASE_URL_VERCEL_PROD/,
    );
  });

  it("attributes edge-only failure to Cloudflare", () => {
    assert.match(
      interpretEdgeVsOrigin("failure", "success"),
      /Bot Fight Mode/,
    );
  });

  it("flags origin failure as app/origin", () => {
    assert.match(interpretEdgeVsOrigin("success", "failure"), /origin/);
  });
});

describe("buildNightlyWhatsAppMessage", () => {
  it("sends a notify-only probe", () => {
    const msg = buildNightlyWhatsAppMessage({
      notifyOnly: true,
      runId: "99",
      extra: "ping",
    });
    assert.match(msg, /manual WhatsApp test/);
    assert.match(msg, /run 99/);
    assert.match(msg, /ping/);
  });

  it("uses a warning icon when edge fails and origin passes", () => {
    const msg = buildNightlyWhatsAppMessage({
      emailResult: "success",
      edgeResult: "failure",
      originResult: "success",
      runId: "1",
    });
    assert.match(msg, /^⚠️ /);
    assert.match(msg, /Edge mydoccy.com FAIL/);
    assert.match(msg, /Origin Vercel OK/);
    assert.match(msg, /Bot Fight Mode/);
  });

  it("fails the nightly icon when origin is skipped and edge fails", () => {
    const msg = buildNightlyWhatsAppMessage({
      emailResult: "success",
      edgeResult: "failure",
      originResult: "skipped",
      runId: "1",
    });
    assert.match(msg, /^❌ /);
  });
});
