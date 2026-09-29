import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeCyprusClinicPhone } from "../../lib/clinic-phone";

/**
 * A new clinic proposed at registration needs its phone: the public Call button
 * shows the clinic's number. Cyprus landlines (22–26) and mobiles (94–97, 99) are
 * accepted, stored as the 8 national digits every clinic phone already uses.
 */

describe("normalizeCyprusClinicPhone", () => {
  it("accepts Cyprus landlines and mobiles in any common format", () => {
    assert.equal(normalizeCyprusClinicPhone("22 123456"), "22123456");
    assert.equal(normalizeCyprusClinicPhone("+357 25 123456"), "25123456");
    assert.equal(normalizeCyprusClinicPhone("00357 26-123456"), "26123456");
    assert.equal(normalizeCyprusClinicPhone("99123456"), "99123456");
    assert.equal(normalizeCyprusClinicPhone("+35796123456"), "96123456");
  });

  it("refuses anything that isn't a Cyprus landline or mobile", () => {
    for (const value of [
      "",
      "   ",
      "2212345", // too short
      "221234567", // too long
      "12345678", // no such prefix
      "80001234", // toll-free, not a clinic line
      "+34 667 000 000", // Spain
      "not a phone",
    ]) {
      assert.equal(normalizeCyprusClinicPhone(value), null, value);
    }
  });
});
