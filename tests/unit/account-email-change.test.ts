import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMAIL_CHANGE_LINK_MINUTES,
  confirmEmailChangeOutcome,
  emailChangeConfirmUrl,
  emailChangeStartStatus,
  pendingEmailChangeFromRow,
} from "../../lib/account-email-change";
import {
  buildEmailChangeConfirmEmail,
  buildEmailChangedNoticeEmail,
  buildPasswordChangedNoticeEmail,
} from "../../lib/account-security-emails";

/**
 * Account → "Change email" (user, 2026-10-11): a link goes to the new address and
 * nothing changes until it is opened; the old address is told once it has changed.
 * A new password signs out her other devices and is announced by email too. These
 * security notices are allowed next to the three automatic emails (user, 2026-10-11).
 */

describe("the confirmation link", () => {
  it("lasts an hour", () => {
    assert.equal(EMAIL_CHANGE_LINK_MINUTES, 60);
  });

  it("opens the confirm page with the token", () => {
    assert.equal(
      emailChangeConfirmUrl("https://www.mydoccy.com/", "abc_DEF-123"),
      "https://www.mydoccy.com/account/confirm-email?token=abc_DEF-123",
    );
  });
});

describe("emailChangeStartStatus", () => {
  it("maps what the database refuses to what the page shows", () => {
    assert.deepEqual(emailChangeStartStatus(null), { status: 200 });
    assert.deepEqual(emailChangeStartStatus({ code: "23505" }), {
      status: 409,
      message: "That email already has a DocCy account.",
    });
    assert.deepEqual(emailChangeStartStatus({ code: "22023", message: "that is already her email" }), {
      status: 400,
      message: "That's already your email.",
    });
    assert.deepEqual(emailChangeStartStatus({ code: "22023", message: "that is not an email address" }), {
      status: 400,
      message: "That doesn't look like an email address.",
    });
    assert.equal(emailChangeStartStatus({ code: "XX000" }).status, 500);
  });
});

describe("pendingEmailChangeFromRow", () => {
  const now = Date.parse("2026-10-11T10:00:00Z");

  it("shows a change that is still waiting", () => {
    assert.deepEqual(
      pendingEmailChangeFromRow({ new_email: "new@example.com", expires_at: "2026-10-11T10:30:00Z" }, now),
      { email: "new@example.com" },
    );
  });

  it("shows nothing once the link has expired, or when nothing waits", () => {
    assert.equal(pendingEmailChangeFromRow({ new_email: "new@example.com", expires_at: "2026-10-11T09:59:59Z" }, now), null);
    assert.equal(pendingEmailChangeFromRow(null, now), null);
  });
});

describe("confirmEmailChangeOutcome", () => {
  it("says the new address is in use from now on", () => {
    assert.deepEqual(confirmEmailChangeOutcome(200, { email: "new@example.com" }), {
      ok: true,
      title: "Your email is changed",
      message:
        "Your DocCy account now uses new@example.com, and booking requests are sent there. You have been signed out on every device: sign in with your new email.",
    });
  });

  it("explains a link that no longer works", () => {
    const outcome = confirmEmailChangeOutcome(410, null);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.title, "This link no longer works");
    assert.match(outcome.message, /Settings → Account/);
  });

  it("explains an address taken meanwhile, and anything else", () => {
    assert.equal(confirmEmailChangeOutcome(409, null).title, "That email is already in use");
    assert.equal(confirmEmailChangeOutcome(500, null).title, "Something went wrong");
  });
});

describe("the emails", () => {
  it("asks the new address to confirm, and says nothing changes otherwise", () => {
    const mail = buildEmailChangeConfirmEmail({
      confirmUrl: "https://www.mydoccy.com/account/confirm-email?token=t",
      minutes: 60,
    });
    assert.equal(mail.subject, "[DocCy] Confirm your new email");
    assert.ok(mail.text.includes("https://www.mydoccy.com/account/confirm-email?token=t"));
    assert.match(mail.text, /60 minutes/);
    assert.match(mail.text, /If you did not ask for this, ignore this email\. Nothing changes\./);
    assert.ok(mail.html.includes("Confirm new email"));
  });

  it("tells the old address what changed and what to do if it was not her", () => {
    const mail = buildEmailChangedNoticeEmail({ newEmail: "new@example.com", siteUrl: "https://www.mydoccy.com" });
    assert.equal(mail.subject, "[DocCy] Your email was changed");
    assert.match(mail.text, /now uses new@example\.com/);
    assert.match(mail.text, /If this was not you/);
    assert.ok(mail.html.includes("new@example.com"));
  });

  it("colours its links for the navy card, and uses the logo made for dark backgrounds", () => {
    const changed = buildEmailChangedNoticeEmail({ newEmail: "new@example.com", siteUrl: "https://www.mydoccy.com" });
    const password = buildPasswordChangedNoticeEmail({ siteUrl: "https://www.mydoccy.com" });
    // Mail apps link a bare address or URL in their own blue, unreadable on navy.
    assert.ok(changed.html.includes('<a href="mailto:new@example.com" style="color:#7DD9DF;'));
    assert.ok(changed.html.includes('<a href="https://www.mydoccy.com" style="color:#7DD9DF;'));
    assert.ok(password.html.includes('<a href="https://www.mydoccy.com/forgot-password" style="color:#7DD9DF;'));
    for (const mail of [changed, password]) {
      assert.ok(mail.html.includes("https://www.mydoccy.com/brand/doccy-logo-on-dark.png"));
      assert.equal((mail.html.match(/<a /g) ?? []).length, (mail.html.match(/<a [^>]*style="/g) ?? []).length);
    }
  });

  it("escapes the address in the HTML", () => {
    const mail = buildEmailChangedNoticeEmail({ newEmail: `"><b>x@example.com`, siteUrl: "https://www.mydoccy.com" });
    assert.ok(!mail.html.includes(`"><b>x@example.com`));
  });

  it("announces a new password and that other devices were signed out", () => {
    const mail = buildPasswordChangedNoticeEmail({ siteUrl: "https://www.mydoccy.com" });
    assert.equal(mail.subject, "[DocCy] Your password was changed");
    assert.match(mail.text, /signed out of DocCy on your other devices/);
    assert.ok(mail.text.includes("https://www.mydoccy.com/forgot-password"));
  });
});
