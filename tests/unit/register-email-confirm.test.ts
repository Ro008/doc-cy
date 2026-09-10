import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REGISTER_EMAIL_CONFIRM_PATH,
  registerEmailConfirmCallbackUrl,
  registerEmailConfirmLinkFromGenerateLink,
  registerEmailConfirmVerifyUrl,
  registerSubmittedEmailConfirmedPath,
  resolveRegisterEmailConfirmOrigin,
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

  it("prefers the public site URL over ephemeral Vercel deployment hosts in production", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevVercelEnv = process.env.VERCEL_ENV;
    const prevVercelUrl = process.env.VERCEL_URL;
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NEXT_PUBLIC_SITE_URL = "";
      process.env.VERCEL_ENV = "production";
      process.env.VERCEL_URL = "doc-preview-xyz.vercel.app";
      assert.equal(resolveRegisterEmailConfirmOrigin(), "https://www.mydoccy.com");

      process.env.NEXT_PUBLIC_SITE_URL = "https://www.mydoccy.com";
      assert.equal(resolveRegisterEmailConfirmOrigin(), "https://www.mydoccy.com");
    } finally {
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
      if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercelEnv;
      if (prevVercelUrl === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = prevVercelUrl;
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
    }
  });

  it("prefers the request origin so local/testing does not email mydoccy.com links", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevVercelEnv = process.env.VERCEL_ENV;
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NEXT_PUBLIC_SITE_URL = "https://www.mydoccy.com";
      process.env.VERCEL_ENV = "";
      process.env.NODE_ENV = "development";
      assert.equal(
        resolveRegisterEmailConfirmOrigin("http://localhost:3100"),
        "http://localhost:3100",
      );
      assert.equal(resolveRegisterEmailConfirmOrigin(), "http://localhost:3000");
    } finally {
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
      if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercelEnv;
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
    }
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
