import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  callNumberForSource,
  directoryPhoneForSave,
  hasDistinctDirectoryPhone,
  inferPublicPhoneSource,
  phonesMatch,
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
