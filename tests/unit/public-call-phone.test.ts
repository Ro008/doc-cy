import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  callNumberForSource,
  directoryPhoneForSave,
  hasDistinctDirectoryPhone,
  inferPublicPhoneSource,
  phonesMatch,
  publicPhoneForProfessional,
  publicPhoneSourceForSave,
} from "../../lib/public-call-phone";

describe("public-call-phone", () => {
  it("treats formatted Cyprus numbers as the same", () => {
    assert.equal(phonesMatch("+35799747322", "+357 99 747322"), true);
    assert.equal(phonesMatch("+35799747322", "+35799111222"), false);
    assert.equal(phonesMatch("", "+35799747322"), false);
  });

  it("hides a second row when directory duplicates mobile", () => {
    assert.equal(
      hasDistinctDirectoryPhone("+35799747322", "+357 99 747322"),
      false,
    );
    assert.equal(
      hasDistinctDirectoryPhone("+35799747322", "+35722123456"),
      true,
    );
  });

  it("defaults Call to the directory number when two distinct numbers exist", () => {
    assert.equal(
      inferPublicPhoneSource({
        mobileNumber: "+35799747322",
        directoryPhone: "+35722123456",
      }),
      "directory",
    );
    assert.equal(
      inferPublicPhoneSource({
        saved: "mobile",
        mobileNumber: "+35799747322",
        directoryPhone: "+35722123456",
      }),
      "mobile",
    );
  });

  it("uses mobile as the only Call number when the listing is empty or the same", () => {
    assert.equal(
      inferPublicPhoneSource({
        mobileNumber: "+35799747322",
        directoryPhone: "",
      }),
      "mobile",
    );
    assert.equal(
      callNumberForSource({
        source: "mobile",
        mobileNumber: "+35799747322",
        directoryPhone: "+35722123456",
      }),
      "+35799747322",
    );
  });

  it("keeps a matching listing number in sync when the single field is edited", () => {
    assert.equal(
      directoryPhoneForSave({
        clinicRowVisible: false,
        clinicPhone: "",
        mobileNumber: "+35799000000",
        initialDirectoryPhone: "+35799747322",
        initialMobileNumber: "+35799747322",
      }),
      "+35799000000",
    );
    assert.equal(
      directoryPhoneForSave({
        clinicRowVisible: false,
        clinicPhone: "",
        mobileNumber: "+35799747322",
        initialDirectoryPhone: "+35722123456",
        initialMobileNumber: "+35799747322",
      }),
      null,
    );
  });

  it("stores the selected source only when two numbers remain distinct", () => {
    assert.equal(
      publicPhoneSourceForSave({
        showPhonePublic: true,
        selected: "directory",
        mobileNumber: "+35799747322",
        directoryPhone: "+35722123456",
      }),
      "directory",
    );
    assert.equal(
      publicPhoneSourceForSave({
        showPhonePublic: true,
        selected: "directory",
        mobileNumber: "+35799747322",
        directoryPhone: null,
      }),
      "mobile",
    );
  });
});

describe("publicPhoneForProfessional", () => {
  const mobile = "+35799747322";
  const directory = "+35722123456";

  it("hides the number unless show_phone_public is on", () => {
    for (const showPhonePublic of [false, null, undefined]) {
      assert.equal(
        publicPhoneForProfessional({
          showPhonePublic,
          publicPhoneSource: "mobile",
          phone: directory,
          mobileNumber: mobile,
        }),
        null,
      );
    }
  });

  it("defaults to the directory number, matching the view's COALESCE", () => {
    for (const publicPhoneSource of [undefined, null, "directory", "nonsense"]) {
      assert.equal(
        publicPhoneForProfessional({
          showPhonePublic: true,
          publicPhoneSource,
          phone: directory,
          mobileNumber: mobile,
        }),
        directory,
      );
    }
  });

  it("returns the mobile number when public_phone_source says so", () => {
    assert.equal(
      publicPhoneForProfessional({
        showPhonePublic: true,
        publicPhoneSource: "mobile",
        phone: directory,
        mobileNumber: mobile,
      }),
      mobile,
    );
  });

  it("treats blank and whitespace-only numbers as null, like NULLIF(BTRIM(..), '')", () => {
    assert.equal(
      publicPhoneForProfessional({
        showPhonePublic: true,
        publicPhoneSource: "directory",
        phone: "   ",
        mobileNumber: mobile,
      }),
      null,
    );
    assert.equal(
      publicPhoneForProfessional({
        showPhonePublic: true,
        publicPhoneSource: "mobile",
        phone: directory,
        mobileNumber: null,
      }),
      null,
    );
  });

  it("does not fall back to the other number when the chosen one is empty", () => {
    assert.equal(
      publicPhoneForProfessional({
        showPhonePublic: true,
        publicPhoneSource: "mobile",
        phone: directory,
        mobileNumber: "",
      }),
      null,
    );
  });
});

describe("publicPhoneForProfessional with a paused clinic", () => {
  const mobile = "+35799747322";
  const directory = "+35722123456";

  it("shows the number when a clinic is paused, even with the Call button never switched on", () => {
    // Clinics are created paused, so this is the state a professional registers into.
    assert.equal(
      publicPhoneForProfessional({
        showPhonePublic: false,
        phone: null,
        mobileNumber: mobile,
        pauseFlags: [true],
      }),
      mobile,
    );
  });

  it("shows it when only one of several clinics is paused", () => {
    assert.equal(
      publicPhoneForProfessional({
        showPhonePublic: false,
        phone: null,
        mobileNumber: mobile,
        pauseFlags: [true, false],
      }),
      mobile,
    );
  });

  it("respects a stored choice when revealing because of a pause", () => {
    assert.equal(
      publicPhoneForProfessional({
        showPhonePublic: false,
        publicPhoneSource: "directory",
        phone: directory,
        mobileNumber: mobile,
        pauseFlags: [true],
      }),
      directory,
    );
  });

  it("stays hidden while every clinic takes online bookings", () => {
    assert.equal(
      publicPhoneForProfessional({
        showPhonePublic: false,
        phone: null,
        mobileNumber: mobile,
        pauseFlags: [false, false],
      }),
      null,
    );
  });

  it("returns null when a clinic is paused but there is no number at all", () => {
    assert.equal(
      publicPhoneForProfessional({
        showPhonePublic: false,
        phone: null,
        mobileNumber: null,
        pauseFlags: [true],
      }),
      null,
    );
  });
});
