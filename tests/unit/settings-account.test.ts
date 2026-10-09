import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  changeEmailMessage,
  changePasswordMessage,
  shortBookingLink,
  validateNewEmail,
} from "../../lib/settings-account";

/**
 * Account tab (user, 2026-10-01): one "Sign-in & security" card (email, password, other
 * devices, this device), and Promote as its own section with a clean booking link.
 */

describe("changePasswordMessage", () => {
  it("says the email is on its way", () => {
    assert.deepEqual(changePasswordMessage(200, { ok: true }, "dr@example.com"), {
      ok: true,
      message: "Check dr@example.com: we sent a link to set a new password.",
    });
  });

  it("asks to wait when there were too many tries", () => {
    assert.deepEqual(changePasswordMessage(429, { ok: false, reason: "rate_limited" }, "dr@example.com"), {
      ok: false,
      message: "Too many tries. Please wait an hour and try again.",
    });
  });

  it("asks to try again for anything else", () => {
    for (const status of [400, 500, 503]) {
      assert.deepEqual(changePasswordMessage(status, null, "dr@example.com"), {
        ok: false,
        message: "Could not send the email. Please try again.",
      });
    }
  });
});

describe("shortBookingLink", () => {
  it("shows the link without protocol, www or tracking", () => {
    assert.equal(
      shortBookingLink(
        "https://www.mydoccy.com/harrison-ford?utm_source=doctor_qr&utm_medium=profile_card&ref=doctor_profile_qr",
      ),
      "mydoccy.com/harrison-ford",
    );
  });

  it("keeps a local host as it is", () => {
    assert.equal(shortBookingLink("http://localhost:3000/harrison-ford?ref=x"), "localhost:3000/harrison-ford");
  });

  it("returns what it was given when it is not a URL", () => {
    assert.equal(shortBookingLink("harrison-ford"), "harrison-ford");
  });
});

/**
 * Changing the sign-in email (user, 2026-10-09): Account → Sign-in & security. The
 * change only applies once the doctor confirms it from a link sent to the new address.
 * EXPECTED TO FAIL until Livio builds POST /api/account/email.
 */
describe("validateNewEmail", () => {
  it("accepts a different, well-formed address", () => {
    assert.equal(validateNewEmail("dr@example.com", " New@Clinic.cy "), null);
  });
  it("asks for an address", () => {
    assert.equal(validateNewEmail("dr@example.com", "  "), "Enter your new email.");
  });
  it("refuses something that is not an email", () => {
    assert.equal(validateNewEmail("dr@example.com", "dr@clinic"), "That doesn't look like an email address.");
  });
  it("refuses the address already in use, whatever its case", () => {
    assert.equal(validateNewEmail("dr@example.com", "DR@example.com"), "That's already your email.");
  });
});

describe("changeEmailMessage", () => {
  it("says the change waits for the link sent to the new address", () => {
    assert.deepEqual(changeEmailMessage(200, {}, "new@clinic.cy"), {
      ok: true,
      message: "Check new@clinic.cy: open the link we sent to confirm it. Until then, keep signing in with your current email.",
    });
  });
  it("says when the address already has an account", () => {
    assert.deepEqual(changeEmailMessage(409, {}, "new@clinic.cy"), {
      ok: false,
      message: "That email already has a DocCy account.",
    });
  });
  it("says the failure is expected while the endpoint is missing", () => {
    const result = changeEmailMessage(404, null, "new@clinic.cy");
    assert.equal(result.ok, false);
    assert.match(result.message, /^Expected to fail for now: .*Livio.*POST \/api\/account\/email/);
  });
  it("asks to wait after too many tries", () => {
    assert.equal(changeEmailMessage(429, null, "new@clinic.cy").message, "Too many tries. Please wait an hour and try again.");
  });
  it("shows the server's message, or a generic one", () => {
    assert.equal(changeEmailMessage(400, { message: "Blocked domain." }, "x@y.cy").message, "Blocked domain.");
    assert.equal(changeEmailMessage(500, null, "x@y.cy").message, "Could not change your email. Please try again.");
  });
});
