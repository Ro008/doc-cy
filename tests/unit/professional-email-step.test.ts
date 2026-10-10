import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  EMAIL_STEP_MAX_AGE_DAYS,
  hasValidEmailStep,
  isProfessionalApiPath,
  PROFESSIONAL_API_ROUTES,
  lastEmailStepAt,
  normalizeSignInCode,
  signInLinkPath,
} from "../../lib/professional-email-step";

/**
 * A professional signs in with her password, then with the link or code emailed to
 * her (user, 2026-09-29). Supabase marks the session from the link or code (and from
 * a password reset) with an `amr` entry `{ method: "otp", timestamp }`. The session
 * counts for 30 days from that mark; a password alone never does.
 */

const NOW = 1_790_000_000; // Unix seconds
const DAY = 86_400;

describe("lastEmailStepAt", () => {
  it("finds the newest otp entry", () => {
    const amr = [
      { method: "otp", timestamp: NOW - 5 * DAY },
      { method: "password", timestamp: NOW },
      { method: "otp", timestamp: NOW - DAY },
    ];
    assert.equal(lastEmailStepAt(amr), NOW - DAY);
  });

  it("ignores passwords, authenticator codes and malformed claims", () => {
    assert.equal(lastEmailStepAt([{ method: "password", timestamp: NOW }]), null);
    assert.equal(lastEmailStepAt([{ method: "totp", timestamp: NOW }]), null);
    assert.equal(lastEmailStepAt([{ method: "otp" }]), null);
    assert.equal(lastEmailStepAt([{ method: "otp", timestamp: "soon" }]), null);
    assert.equal(lastEmailStepAt(null), null);
    assert.equal(lastEmailStepAt("otp"), null);
  });
});

describe("hasValidEmailStep", () => {
  it("lasts 30 days", () => {
    assert.equal(EMAIL_STEP_MAX_AGE_DAYS, 30);
    assert.equal(hasValidEmailStep([{ method: "otp", timestamp: NOW - 60 }], NOW), true);
    assert.equal(hasValidEmailStep([{ method: "otp", timestamp: NOW - 29 * DAY }], NOW), true);
    assert.equal(hasValidEmailStep([{ method: "otp", timestamp: NOW - 31 * DAY }], NOW), false);
  });

  it("is never satisfied by a password alone", () => {
    assert.equal(hasValidEmailStep([{ method: "password", timestamp: NOW }], NOW), false);
    assert.equal(hasValidEmailStep([], NOW), false);
    assert.equal(hasValidEmailStep(undefined, NOW), false);
  });

  it("an old email step doesn't count because of a new password", () => {
    const amr = [
      { method: "otp", timestamp: NOW - 40 * DAY },
      { method: "password", timestamp: NOW - 60 },
    ];
    assert.equal(hasValidEmailStep(amr, NOW), false);
  });
});

describe("isProfessionalApiPath", () => {
  it("covers the professional's own API routes", () => {
    for (const path of [
      "/api/appointments/manual",
      "/api/appointments/abc/confirm",
      "/api/doctor-gesy",
      "/api/doctor-locations",
      "/api/doctor-online-bookings",
      "/api/doctor-services",
      "/api/doctor-settings",
      "/api/doctor-settings/trial-notice",
      "/api/professional-clinics/abc/dismiss-pause-notice",
      "/api/professional-mobile",
      "/api/professional-mobile/visibility",
      "/api/name-change-requests",
      "/api/photo-change-requests",
      "/api/professional-photo",
      "/api/professional-specialties",
      "/api/specialty-requests",
    ]) {
      assert.equal(isProfessionalApiPath(path), true, path);
    }
  });

  it("leaves patients' booking, sign-in, registration and admin routes alone", () => {
    for (const path of [
      "/api/appointments",
      "/api/auth/sign-in",
      "/api/auth/session-audit",
      "/api/account/summary",
      "/api/register/contact-check",
      "/api/internal/requests/x/approve",
      "/api/directory/contact-reveal",
    ]) {
      assert.equal(isProfessionalApiPath(path), false, path);
    }
  });
});

describe("middleware matcher", () => {
  it("runs the middleware on every professional API route (else the gate never sees them)", () => {
    const source = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    const matcher = source.slice(source.indexOf("matcher:"));
    for (const route of PROFESSIONAL_API_ROUTES) {
      assert.match(matcher, new RegExp(`"${route}(/:path[*+])?"`), route);
    }
  });
});

describe("normalizeSignInCode", () => {
  it("keeps the digits of a 6 to 10 digit code", () => {
    assert.equal(normalizeSignInCode("123456"), "123456");
    assert.equal(normalizeSignInCode(" 1234 5678 "), "12345678");
    assert.equal(normalizeSignInCode("123-456"), "123456");
  });

  it("refuses anything else", () => {
    assert.equal(normalizeSignInCode(""), null);
    assert.equal(normalizeSignInCode("12345"), null);
    assert.equal(normalizeSignInCode("12345678901"), null);
    assert.equal(normalizeSignInCode("abcdef"), null);
  });
});

describe("signInLinkPath", () => {
  it("carries the token and a safe next page", () => {
    assert.equal(signInLinkPath("tok_1", "/agenda/settings"), "/auth/sign-in-link?token_hash=tok_1&next=%2Fagenda%2Fsettings");
    assert.equal(signInLinkPath("tok_1", null), "/auth/sign-in-link?token_hash=tok_1");
  });
});
