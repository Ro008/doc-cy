import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCyprusClinicPhoneInput, normalizeCyprusClinicPhone } from "../../lib/clinic-phone";

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

/**
 * Settings → Clinics: the phone field on a clinic card shows the 8 national digits
 * grouped the Cypriot way while she types; "+357" sits in front of the field.
 */
describe("formatCyprusClinicPhoneInput", () => {
  it("groups the digits as 2 + 6, landline or mobile", () => {
    assert.equal(formatCyprusClinicPhoneInput("25123456"), "25 123456");
    assert.equal(formatCyprusClinicPhoneInput("99123456"), "99 123456");
    assert.equal(formatCyprusClinicPhoneInput("25-12 34 56"), "25 123456");
  });

  it("works part-way through typing", () => {
    assert.equal(formatCyprusClinicPhoneInput(""), "");
    assert.equal(formatCyprusClinicPhoneInput("2"), "2");
    assert.equal(formatCyprusClinicPhoneInput("25"), "25");
    assert.equal(formatCyprusClinicPhoneInput("251"), "25 1");
  });

  it("drops a pasted country code and anything past 8 digits", () => {
    assert.equal(formatCyprusClinicPhoneInput("+357 25 123456"), "25 123456");
    assert.equal(formatCyprusClinicPhoneInput("0035725123456"), "25 123456");
    assert.equal(formatCyprusClinicPhoneInput("35725123456"), "25 123456");
    assert.equal(formatCyprusClinicPhoneInput("251234567"), "25 123456");
  });
});
