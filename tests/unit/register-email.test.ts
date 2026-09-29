import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGISTER_EMAIL_HTML_PATTERN, isValidRegisterEmail } from "../../lib/register-email";
import { PASSWORD_POLICY_HTML_PATTERN } from "../../lib/password-policy";

/** How browsers apply a `pattern` attribute: anchored, compiled with `v` (Chrome 112+) or `u`. */
function htmlPattern(pattern: string, flag: "u" | "v"): RegExp {
  return new RegExp(`^(?:${pattern})$`, flag);
}

describe("register email validation", () => {
  it("compiles as an HTML pattern in both u and v mode (an invalid pattern is silently ignored)", () => {
    assert.doesNotThrow(() => htmlPattern(REGISTER_EMAIL_HTML_PATTERN, "v"));
    assert.doesNotThrow(() => htmlPattern(REGISTER_EMAIL_HTML_PATTERN, "u"));
    // Same guard for the password pattern that shares the form.
    assert.doesNotThrow(() => htmlPattern(PASSWORD_POLICY_HTML_PATTERN, "v"));
  });

  it("accepts real addresses, including + aliases", () => {
    for (const email of [
      "maria@practice.com",
      "rociosirvent+test@gmail.com",
      "dr.georgiou@clinic.com.cy",
    ]) {
      assert.equal(isValidRegisterEmail(email), true, email);
      assert.equal(htmlPattern(REGISTER_EMAIL_HTML_PATTERN, "v").test(email), true, email);
    }
  });

  it("rejects addresses without a proper domain", () => {
    for (const email of ["sdfgdfg@a", "maria@practice", "maria@@practice.com", "maria", "@practice.com", ""]) {
      assert.equal(isValidRegisterEmail(email), false, email);
      assert.equal(htmlPattern(REGISTER_EMAIL_HTML_PATTERN, "v").test(email), false, email);
    }
  });
});
