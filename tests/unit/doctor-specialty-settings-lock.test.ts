import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSpecialtyChangeAttempt,
  SPECIALTY_CHANGE_REQUIRES_SUPPORT_MESSAGE,
} from "@/lib/doctor-specialty-settings-lock";

describe("doctor specialty settings lock", () => {
  it("allows omitted specialty (legacy clients may stop sending it)", () => {
    assert.equal(isSpecialtyChangeAttempt("Dentistry", undefined), false);
    assert.equal(isSpecialtyChangeAttempt("Dentistry", null), false);
  });

  it("allows identical specialty (legacy clients still posting current value)", () => {
    assert.equal(isSpecialtyChangeAttempt("Dentistry", "Dentistry"), false);
    assert.equal(isSpecialtyChangeAttempt("Dentistry", "  Dentistry  "), false);
  });

  it("detects a real change attempt", () => {
    assert.equal(isSpecialtyChangeAttempt("Dentistry", "Dermatology"), true);
    assert.equal(isSpecialtyChangeAttempt("Dentistry", ""), true);
    assert.equal(SPECIALTY_CHANGE_REQUIRES_SUPPORT_MESSAGE.length > 20, true);
  });
});
