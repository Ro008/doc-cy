import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isStrongPassword } from "@/lib/password-policy";

import { FIXTURE_DOCTOR, generateFixturePassword } from "../../scripts/ci-db/fixtures-lib.mjs";

describe("ci-db generateFixturePassword", () => {
  it("meets the app's password policy", () => {
    for (let i = 0; i < 50; i += 1) {
      const password = generateFixturePassword();
      assert.ok(isStrongPassword(password), `weak password generated: ${password}`);
    }
  });

  it("is different on every run", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateFixturePassword()));
    assert.equal(seen.size, 50);
  });
});

describe("ci-db FIXTURE_DOCTOR", () => {
  it("is the andreas-nikos profile the booking and account specs expect", () => {
    assert.equal(FIXTURE_DOCTOR.slug, "andreas-nikos");
  });

  it("uses an email on the reserved .test domain, so no real inbox can receive it", () => {
    assert.match(FIXTURE_DOCTOR.email, /@[a-z0-9-]+\.test$/);
  });
});
