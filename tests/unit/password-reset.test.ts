import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTH_CALLBACK_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  forgotPasswordPathWithEmail,
  isAllowedPasswordResetOrigin,
  isAuthAccountUiPath,
  isAuthCallbackPath,
  passwordResetCallbackUrl,
  passwordResetLinkFromGenerateLink,
  passwordResetVerifyUrl,
} from "@/lib/password-reset";
import { buildPasswordResetEmailContent } from "@/lib/send-password-reset-email";

describe("password reset paths", () => {
  it("builds the recovery redirect URL without putting email in the query", () => {
    assert.equal(
      passwordResetCallbackUrl("https://www.mydoccy.com"),
      `https://www.mydoccy.com${AUTH_CALLBACK_PATH}`,
    );
    assert.equal(
      passwordResetCallbackUrl("http://localhost:3000/"),
      `http://localhost:3000${AUTH_CALLBACK_PATH}`,
    );
  });

  it("carries a typed login email to the forgot-password page only", () => {
    assert.equal(forgotPasswordPathWithEmail(""), FORGOT_PASSWORD_PATH);
    assert.equal(
      forgotPasswordPathWithEmail("  maria@clinic.com "),
      `${FORGOT_PASSWORD_PATH}?email=maria%40clinic.com`,
    );
  });

  it("treats login and reset screens as account UI, not the callback", () => {
    assert.equal(isAuthAccountUiPath("/login"), true);
    assert.equal(isAuthAccountUiPath(FORGOT_PASSWORD_PATH), true);
    assert.equal(isAuthAccountUiPath(RESET_PASSWORD_PATH), true);
    assert.equal(isAuthCallbackPath(AUTH_CALLBACK_PATH), true);
    assert.equal(isAuthAccountUiPath(AUTH_CALLBACK_PATH), false);
  });

  it("allows local and DocCy origins for recovery links, not arbitrary hosts", () => {
    assert.equal(isAllowedPasswordResetOrigin("http://localhost:3000"), true);
    assert.equal(isAllowedPasswordResetOrigin("http://127.0.0.1:3100"), true);
    assert.equal(isAllowedPasswordResetOrigin("https://www.mydoccy.com"), true);
    assert.equal(isAllowedPasswordResetOrigin("https://doc-cy-git-main.vercel.app"), true);
    assert.equal(isAllowedPasswordResetOrigin("https://evil.example"), false);
    assert.equal(isAllowedPasswordResetOrigin("http://www.mydoccy.com"), false);
  });

  it("builds a callback URL with the recovery token, not an email", () => {
    assert.equal(
      passwordResetVerifyUrl("https://www.mydoccy.com", "abc.def"),
      `https://www.mydoccy.com${AUTH_CALLBACK_PATH}?token_hash=abc.def&type=recovery`,
    );
    assert.equal(
      passwordResetLinkFromGenerateLink("https://www.mydoccy.com", {
        hashed_token: "tok",
        action_link: "https://project.supabase.co/auth/v1/verify?token=x",
      }),
      `https://www.mydoccy.com${AUTH_CALLBACK_PATH}?token_hash=tok&type=recovery`,
    );
  });
});

describe("password reset email copy", () => {
  it("is branded as DocCy and never mentions Supabase", () => {
    const content = buildPasswordResetEmailContent({
      resetUrl: "https://www.mydoccy.com/auth/callback?token_hash=tok&type=recovery",
    });
    assert.equal(content.subject, "[DocCy] Reset your password");
    assert.match(content.text, /DocCy practitioner account/);
    assert.match(content.html, /Reset your DocCy password/);
    assert.match(content.html, /Choose a new password/);
    assert.match(content.html, /www\.mydoccy\.com\/brand\/doccy-logo\.png/);
    assert.equal(/supabase/i.test(content.subject), false);
    assert.equal(/supabase/i.test(content.text), false);
    assert.equal(/supabase/i.test(content.html), false);
  });
});
