import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { changePasswordMessage, shortBookingLink } from "../../lib/settings-account";

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
