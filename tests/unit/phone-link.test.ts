import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { phoneToTelHref } from "../../lib/phone-link";

describe("phoneToTelHref", () => {
  it("formats Cyprus local numbers with +357", () => {
    assert.equal(phoneToTelHref("26 223333"), "tel:+35726223333");
    assert.equal(phoneToTelHref("99 095023"), "tel:+35799095023");
  });

  it("keeps numbers that already include country code", () => {
    assert.equal(phoneToTelHref("+357 26 223333"), "tel:+35726223333");
  });

  it("returns null for empty values", () => {
    assert.equal(phoneToTelHref(""), null);
    assert.equal(phoneToTelHref(null), null);
  });
});
