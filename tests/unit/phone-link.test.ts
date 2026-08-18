import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCyprusPhoneDisplay, phoneToTelHref } from "../../lib/phone-link";

describe("phoneToTelHref", () => {
  it("formats Cyprus local numbers with +357", () => {
    assert.equal(phoneToTelHref("26 223333"), "tel:+35726223333");
    assert.equal(phoneToTelHref("99 095023"), "tel:+35799095023");
  });

  it("keeps numbers that already include country code", () => {
    assert.equal(phoneToTelHref("+357 26 223333"), "tel:+35726223333");
  });

  it("strips a leading 00 international prefix", () => {
    assert.equal(phoneToTelHref("0035799123456"), "tel:+35799123456");
  });

  it("returns null for empty values", () => {
    assert.equal(phoneToTelHref(""), null);
    assert.equal(phoneToTelHref(null), null);
  });
});

describe("formatCyprusPhoneDisplay", () => {
  it("renders local 8-digit numbers with +357", () => {
    assert.equal(formatCyprusPhoneDisplay("99 123456"), "+357 99 123456");
    assert.equal(formatCyprusPhoneDisplay("26223333"), "+357 26 223333");
  });

  it("normalizes numbers that already include +357", () => {
    assert.equal(formatCyprusPhoneDisplay("+35799123456"), "+357 99 123456");
  });
});
