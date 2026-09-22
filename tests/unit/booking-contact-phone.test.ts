import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTACT_PHONE_REQUIRED_CODE,
  contactPhoneState,
  onlineBookingUnavailable,
  normalizeContactPhone,
  pauseFlagsAfterChange,
} from "../../lib/booking-contact-phone";

describe("onlineBookingUnavailable", () => {
  it("is true only when every clinic has online bookings paused", () => {
    assert.equal(onlineBookingUnavailable([true]), true);
    assert.equal(onlineBookingUnavailable([true, true]), true);
    assert.equal(onlineBookingUnavailable([false]), false);
    assert.equal(onlineBookingUnavailable([true, false]), false);
    assert.equal(onlineBookingUnavailable([false, false]), false);
  });

  it("stays false with no known clinics, so an unknown state never blocks the professional", () => {
    assert.equal(onlineBookingUnavailable([]), false);
  });
});

describe("pauseFlagsAfterChange", () => {
  const clinics = [
    { id: "a", pauseOnlineBookings: false },
    { id: "b", pauseOnlineBookings: true },
  ];

  it("projects the state the account would land in after flipping one clinic", () => {
    assert.deepEqual(pauseFlagsAfterChange(clinics, "a", true), [true, true]);
    assert.deepEqual(pauseFlagsAfterChange(clinics, "b", false), [false, false]);
  });

  it("leaves the other clinics untouched", () => {
    assert.deepEqual(pauseFlagsAfterChange(clinics, "a", false), [false, true]);
  });

  it("ignores an unknown clinic id", () => {
    assert.deepEqual(pauseFlagsAfterChange(clinics, "zzz", true), [false, true]);
  });
});

describe("contactPhoneState", () => {
  it("asks for nothing while at least one clinic still takes online bookings", () => {
    const state = contactPhoneState({
      pauseFlags: [true, false],
      mobileNumber: "",
      directoryPhone: "",
    });
    assert.equal(state.required, false);
    assert.equal(state.needsNumber, false);
    assert.equal(state.lockCallOn, false);
  });

  it("locks the Call button on the mobile number once every clinic is paused", () => {
    const state = contactPhoneState({
      pauseFlags: [true],
      mobileNumber: "+357 99 123456",
      directoryPhone: "",
    });
    assert.equal(state.required, true);
    assert.equal(state.source, "mobile");
    assert.equal(state.callNumber, "+357 99 123456");
    assert.equal(state.needsNumber, false);
    assert.equal(state.lockCallOn, true);
  });

  it("falls back to the clinic number when there is no mobile", () => {
    const state = contactPhoneState({
      pauseFlags: [true],
      mobileNumber: "   ",
      directoryPhone: "+357 22 445566",
      publicPhoneSource: "mobile",
    });
    assert.equal(state.source, "directory");
    assert.equal(state.callNumber, "+357 22 445566");
    assert.equal(state.needsNumber, false);
    assert.equal(state.lockCallOn, true);
  });

  it("honours the saved choice when both numbers exist", () => {
    const both = {
      pauseFlags: [true],
      mobileNumber: "+357 99 123456",
      directoryPhone: "+357 22 445566",
    } as const;
    assert.equal(contactPhoneState({ ...both, publicPhoneSource: "directory" }).callNumber, "+357 22 445566");
    assert.equal(contactPhoneState({ ...both, publicPhoneSource: "mobile" }).callNumber, "+357 99 123456");
  });

  it("flags that a number must be collected when the account has none", () => {
    const state = contactPhoneState({
      pauseFlags: [true],
      mobileNumber: "",
      directoryPhone: null,
    });
    assert.equal(state.required, true);
    assert.equal(state.callNumber, "");
    assert.equal(state.needsNumber, true);
    assert.equal(state.lockCallOn, false);
  });

  it("treats blank numbers as missing", () => {
    const state = contactPhoneState({
      pauseFlags: [true, true],
      mobileNumber: "   ",
      directoryPhone: "  ",
    });
    assert.equal(state.needsNumber, true);
  });
});

describe("CONTACT_PHONE_REQUIRED_CODE", () => {
  it("is a stable code the client can branch on", () => {
    assert.equal(CONTACT_PHONE_REQUIRED_CODE, "contact_phone_required");
  });
});

describe("normalizeContactPhone", () => {
  it("accepts a Cyprus number typed in any common shape", () => {
    assert.equal(normalizeContactPhone("99123456"), "+357 99 123456");
    assert.equal(normalizeContactPhone(" +357 99 123456 "), "+357 99 123456");
    assert.equal(normalizeContactPhone("00357 99 123456"), "+357 99 123456");
  });

  it("rejects anything too short to be a phone number", () => {
    assert.equal(normalizeContactPhone(""), null);
    assert.equal(normalizeContactPhone("   "), null);
    assert.equal(normalizeContactPhone("12345"), null);
    assert.equal(normalizeContactPhone("abc"), null);
  });
});
