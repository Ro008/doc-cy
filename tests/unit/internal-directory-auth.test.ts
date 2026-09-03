import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isInternalDirectoryCookieAuthorized,
  readInternalDirectorySecrets,
  roleFromCookieValue,
} from "../../lib/internal-directory-auth-core";

const secrets = { founder: "founder-pass", partner: "partner-pass" };

describe("internal directory gate roles", () => {
  it("maps founder and partner cookies to distinct roles", () => {
    assert.equal(roleFromCookieValue("founder-pass", secrets), "founder");
    assert.equal(roleFromCookieValue("partner-pass", secrets), "partner");
    assert.equal(roleFromCookieValue("nope", secrets), null);
    assert.equal(roleFromCookieValue("", secrets), null);
    assert.equal(isInternalDirectoryCookieAuthorized("partner-pass", secrets), true);
  });

  it("treats a matching partner secret as founder when passwords collide", () => {
    const same = { founder: "shared", partner: "shared" };
    assert.equal(roleFromCookieValue("shared", same), "founder");
  });

  it("ignores an empty partner secret", () => {
    assert.equal(
      roleFromCookieValue("x", { founder: "founder-pass", partner: "" }),
      null,
    );
    assert.equal(
      readInternalDirectorySecrets({
        INTERNAL_DIRECTORY_SECRET: " a ",
        INTERNAL_DIRECTORY_PARTNER_SECRET: " b ",
      } as NodeJS.ProcessEnv).partner,
      "b",
    );
  });
});
