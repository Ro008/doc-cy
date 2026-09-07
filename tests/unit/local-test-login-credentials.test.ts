import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TEST_LOGIN_PASSWORD_METADATA_KEY,
  withLocalTestLoginPassword,
} from "@/lib/local-test-login-credentials";

describe("local test login password metadata", () => {
  it("keeps existing auth metadata when the plaintext password changes", () => {
    const next = withLocalTestLoginPassword(
      { full_name: "Andreas Nikos", role: "doctor", [TEST_LOGIN_PASSWORD_METADATA_KEY]: "demo123" },
      "new-pass-9",
    );
    assert.equal(next.full_name, "Andreas Nikos");
    assert.equal(next.role, "doctor");
    assert.equal(next[TEST_LOGIN_PASSWORD_METADATA_KEY], "new-pass-9");
  });
});
