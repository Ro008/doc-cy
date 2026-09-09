import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HTML_PATTERN,
  isStrongPassword,
} from "@/lib/password-policy";

describe("password policy", () => {
  it("accepts a password that meets every rule", () => {
    assert.equal(isStrongPassword("StrongPass123!"), true);
    assert.equal(isStrongPassword("Abcd123!"), true);
  });

  it("rejects short, missing-class, and oversized passwords", () => {
    assert.equal(isStrongPassword("Ab1!aa"), false);
    assert.equal(isStrongPassword("strongpass123!"), false);
    assert.equal(isStrongPassword("STRONGPASS123!"), false);
    assert.equal(isStrongPassword("StrongPass!!!!"), false);
    assert.equal(isStrongPassword("StrongPass1234"), false);
    assert.equal(isStrongPassword("A".repeat(PASSWORD_MAX_LENGTH + 1)), false);
  });

  it("keeps HTML pattern in sync with the JS check for typical cases", () => {
    const pattern = new RegExp(`^${PASSWORD_POLICY_HTML_PATTERN}$`);
    const samples = [
      ["StrongPass123!", true],
      ["password", false],
      ["Password1", false],
      ["Password!", false],
      ["Pass1!", false],
    ] as const;
    for (const [value, expected] of samples) {
      assert.equal(isStrongPassword(value), expected, value);
      assert.equal(pattern.test(value), expected, `html:${value}`);
    }
    assert.equal(PASSWORD_MIN_LENGTH, 8);
  });
});
