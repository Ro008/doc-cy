import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REGISTER_PHONE_PREFERRED_COUNTRIES,
  composeRegisterPhone,
  isValidRegisterMobile,
  registerMobileExample,
  registerPhoneCountryName,
} from "../../lib/register-phone";

describe("register mobile number validation", () => {
  it("accepts a real mobile for the chosen country code", () => {
    assert.equal(isValidRegisterMobile("+34667000000"), true);
    assert.equal(isValidRegisterMobile("+35799123456"), true);
    assert.equal(isValidRegisterMobile("+447400123456"), true);
    assert.equal(isValidRegisterMobile("+306912345678"), true);
  });

  it("rejects numbers that do not fit the country's mobile pattern", () => {
    // Right length for Spain, but Spanish mobiles start with 6 or 7.
    assert.equal(isValidRegisterMobile("+34123456789"), false);
    // A Cyprus landline is not a mobile.
    assert.equal(isValidRegisterMobile("+35722123456"), false);
    // Too short.
    assert.equal(isValidRegisterMobile("+3579912"), false);
  });

  it("rejects an empty value or a bare dial code", () => {
    assert.equal(isValidRegisterMobile(""), false);
    assert.equal(isValidRegisterMobile("+357"), false);
    assert.equal(isValidRegisterMobile("   "), false);
  });

  it("gives a per-country example for the placeholder", () => {
    assert.equal(registerMobileExample("es"), "+34 612 34 56 78");
    assert.match(registerMobileExample("cy") ?? "", /^\+357 9/);
    assert.equal(registerMobileExample("zz"), null);
  });

  it("names the country for the error message", () => {
    assert.equal(registerPhoneCountryName("es"), "Spain");
    assert.equal(registerPhoneCountryName("cy"), "Cyprus");
  });

  it("puts Cyprus first among the preferred countries", () => {
    assert.equal(REGISTER_PHONE_PREFERRED_COUNTRIES[0], "cy");
  });

  it("combines the chosen country with the typed number", () => {
    assert.deepEqual(composeRegisterPhone("es", "667 000 000"), {
      e164: "+34667000000",
      country: "ES",
    });
    // National trunk "0" is dropped the way the country writes it.
    assert.deepEqual(composeRegisterPhone("gb", "07400 123456"), {
      e164: "+447400123456",
      country: "GB",
    });
    assert.deepEqual(composeRegisterPhone("cy", ""), { e164: "", country: "CY" });
  });

  it("lets a pasted international number pick its own country", () => {
    assert.deepEqual(composeRegisterPhone("cy", "+34 667 000 000"), {
      e164: "+34667000000",
      country: "ES",
    });
  });
});
