import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEmailChangeConfirmEmail,
  buildEmailChangedNoticeEmail,
  buildNewSignInAlertEmail,
  buildPasswordChangedNoticeEmail,
} from "../../lib/account-security-emails";
import { EMAIL_LOGO_URL, EMAIL_SHELL_OPEN } from "../../lib/email-brand";
import { buildPatientReviewRequestEmail } from "../../lib/review-request-email";
import { buildDoctorRegistrationReceivedEmailContent } from "../../lib/send-doctor-registration-received-email";
import { buildPasswordResetEmailContent } from "../../lib/send-password-reset-email";
import { buildSignInLinkEmailContent } from "../../lib/send-sign-in-link-email";

/**
 * Every email carries the logo (user, 2026-10-11). It lives in the shared navy card,
 * so an email gets it by using the card, and none prints it a second time.
 */

function logoCount(html: string): number {
  return html.split(EMAIL_LOGO_URL).length - 1;
}

describe("the logo in emails", () => {
  it("is the one made for dark backgrounds, and sits in the shared card", () => {
    assert.equal(EMAIL_LOGO_URL, "https://www.mydoccy.com/brand/doccy-logo-on-dark.png");
    assert.equal(logoCount(EMAIL_SHELL_OPEN), 1);
    assert.match(EMAIL_SHELL_OPEN, /<img [^>]*alt="DocCy"/);
  });

  it("appears once in an email that had none before", () => {
    const review = buildPatientReviewRequestEmail({
      patientName: "Anna Test",
      professionalName: "Dr Maria Test",
      appointmentIso: "2026-10-12T09:00:00.000Z",
      reviewUrl: "https://www.mydoccy.com/review/abc",
    } as Parameters<typeof buildPatientReviewRequestEmail>[0]);
    assert.equal(logoCount(review.html), 1);
  });

  it("appears once, not twice, in the emails that already had it", () => {
    const site = "https://www.mydoccy.com";
    const mails = [
      buildSignInLinkEmailContent({ signInUrl: `${site}/x`, code: "12345678" }),
      buildPasswordResetEmailContent({ resetUrl: `${site}/y` }),
      buildDoctorRegistrationReceivedEmailContent({ doctorName: "Maria Test" }),
      buildEmailChangeConfirmEmail({ confirmUrl: `${site}/z`, minutes: 60 }),
      buildEmailChangedNoticeEmail({ newEmail: "new@example.com", siteUrl: site }),
      buildPasswordChangedNoticeEmail({ siteUrl: site }),
    ];
    for (const mail of mails) assert.equal(logoCount(mail.html), 1, mail.subject);
  });
});

describe("the new sign-in email", () => {
  const mail = buildNewSignInAlertEmail({
    when: "2026-10-11T08:00:00.000Z",
    ip: "1.2.3.4",
    userAgent: "<Firefox>",
    siteUrl: "https://www.mydoccy.com",
  });

  it("uses the shared card and the logo", () => {
    assert.equal(mail.subject, "[DocCy] New sign-in detected");
    assert.ok(mail.html.includes(EMAIL_SHELL_OPEN));
    assert.equal(logoCount(mail.html), 1);
  });

  it("says when and from where, escaped, and how to react", () => {
    assert.ok(mail.html.includes("2026-10-11T08:00:00.000Z"));
    assert.ok(mail.html.includes("1.2.3.4"));
    assert.ok(mail.html.includes("&lt;Firefox&gt;"));
    assert.ok(mail.html.includes('<a href="https://www.mydoccy.com/forgot-password" style="color:#7DD9DF;'));
    assert.ok(mail.text.includes("https://www.mydoccy.com/forgot-password"));
  });

  it("copes with a missing address or browser", () => {
    const bare = buildNewSignInAlertEmail({ when: "x", ip: null, userAgent: "", siteUrl: "https://www.mydoccy.com/" });
    assert.equal((bare.html.match(/unavailable/g) ?? []).length, 2);
    assert.ok(bare.text.includes("https://www.mydoccy.com/forgot-password"));
  });
});
