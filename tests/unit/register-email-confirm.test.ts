import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REGISTER_EMAIL_CONFIRM_PATH,
  registerEmailConfirmCallbackUrl,
  registerEmailConfirmLinkFromGenerateLink,
  registerEmailConfirmVerifyUrl,
  registerSubmittedEmailConfirmedPath,
} from "../../lib/register-email-confirm";
import { buildDoctorRegistrationReceivedEmailContent } from "../../lib/send-doctor-registration-received-email";

describe("register email confirm URLs", () => {
  it("builds a DocCy confirm-email link with token_hash, not a 6-digit code", () => {
    assert.equal(
      registerEmailConfirmCallbackUrl("https://www.mydoccy.com"),
      `https://www.mydoccy.com${REGISTER_EMAIL_CONFIRM_PATH}`,
    );
    assert.equal(
      registerEmailConfirmVerifyUrl("https://www.mydoccy.com", "abc.def"),
      `https://www.mydoccy.com${REGISTER_EMAIL_CONFIRM_PATH}?token_hash=abc.def&type=magiclink`,
    );
    assert.equal(
      registerEmailConfirmLinkFromGenerateLink("https://www.mydoccy.com", {
        hashed_token: "tok",
        action_link: "https://project.supabase.co/auth/v1/verify?token=x",
      }),
      `https://www.mydoccy.com${REGISTER_EMAIL_CONFIRM_PATH}?token_hash=tok&type=magiclink`,
    );
    assert.equal(
      registerSubmittedEmailConfirmedPath(false),
      "/register?submitted=1&email=confirmed",
    );
    assert.equal(
      registerSubmittedEmailConfirmedPath(true),
      "/register?submitted=1&email=confirmed&claimed=1",
    );
  });
});

describe("register received email copy", () => {
  it("uses a magic link CTA and never mentions a numeric code", () => {
    const content = buildDoctorRegistrationReceivedEmailContent({
      doctorName: "Maria Papadopoulos",
      confirmUrl: "https://www.mydoccy.com/auth/confirm-email?token_hash=tok&type=magiclink",
    });
    assert.equal(content.subject, "[DocCy] We received your application");
    assert.match(content.html, /Confirm your email/);
    assert.match(content.text, /not a code/);
    assert.equal(/\b\d{6}\b/.test(content.text), false);
    assert.equal(/supabase/i.test(content.html), false);
  });
});
