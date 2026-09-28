import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REGISTER_ACCOUNT_EXISTS_MESSAGE,
  REGISTER_EMAIL_IN_USE_MESSAGE,
  REGISTER_MOBILE_IN_USE_MESSAGE,
  parseProfessionalContactUse,
  professionalContactUniqueViolation,
  professionalEmailKey,
  professionalMobileKey,
  registerContactMessages,
  registrationContactErrorCode,
} from "../../lib/professional-contact";

/**
 * A professional's registration email and personal mobile belong to one real
 * professional each (test profiles never block). These are the shared rules the
 * form, the submit action, the founders' review and the settings routes use; the
 * database enforces the same keys with unique indexes.
 */

describe("professional contact keys", () => {
  it("compares emails without case or surrounding spaces", () => {
    assert.equal(professionalEmailKey("  Dr.Name@Example.COM "), "dr.name@example.com");
    assert.equal(professionalEmailKey(""), "");
    assert.equal(professionalEmailKey(null), "");
  });

  it("compares mobiles by their digits, whatever the formatting", () => {
    assert.equal(professionalMobileKey("+357 99 123456"), "35799123456");
    assert.equal(professionalMobileKey("+35799123456"), "35799123456");
    assert.equal(professionalMobileKey(" "), "");
    assert.equal(professionalMobileKey(undefined), "");
  });
});

describe("parseProfessionalContactUse", () => {
  it("reads the database function's row", () => {
    assert.deepEqual(parseProfessionalContactUse([{ email_in_use: "professional", mobile_in_use: true }]), {
      email: "professional",
      mobile: true,
    });
    assert.deepEqual(parseProfessionalContactUse({ email_in_use: "account", mobile_in_use: false }), {
      email: "account",
      mobile: false,
    });
  });

  it("treats anything unexpected as free", () => {
    assert.deepEqual(parseProfessionalContactUse([]), { email: null, mobile: false });
    assert.deepEqual(parseProfessionalContactUse(null), { email: null, mobile: false });
    assert.deepEqual(parseProfessionalContactUse([{ email_in_use: "other", mobile_in_use: "yes" }]), {
      email: null,
      mobile: false,
    });
  });
});

describe("registrationContactErrorCode", () => {
  it("is null when both are free", () => {
    assert.equal(registrationContactErrorCode({ email: null, mobile: false }), null);
  });

  it("reports the email first", () => {
    assert.equal(registrationContactErrorCode({ email: "professional", mobile: true }), "email_in_use");
    assert.equal(registrationContactErrorCode({ email: "account", mobile: false }), "auth_user_exists");
  });

  it("reports the mobile when only it is taken", () => {
    assert.equal(registrationContactErrorCode({ email: null, mobile: true }), "mobile_in_use");
  });
});

describe("registerContactMessages", () => {
  it("gives one message per taken field and never names the other professional", () => {
    assert.deepEqual(registerContactMessages({ email: "professional", mobile: true }), {
      email: REGISTER_EMAIL_IN_USE_MESSAGE,
      mobile: REGISTER_MOBILE_IN_USE_MESSAGE,
    });
    assert.deepEqual(registerContactMessages({ email: "account", mobile: false }), {
      email: REGISTER_ACCOUNT_EXISTS_MESSAGE,
      mobile: null,
    });
    assert.deepEqual(registerContactMessages({ email: null, mobile: false }), { email: null, mobile: null });
    assert.match(REGISTER_EMAIL_IN_USE_MESSAGE, /already used by another professional/);
    assert.match(REGISTER_MOBILE_IN_USE_MESSAGE, /already used by another professional/);
  });
});

describe("professionalContactUniqueViolation", () => {
  it("names the field from the unique index in a 23505 error", () => {
    assert.equal(
      professionalContactUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "professionals_mobile_number_unique_idx"',
      }),
      "mobile",
    );
    assert.equal(
      professionalContactUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "professionals_registration_email_unique_idx"',
      }),
      "email",
    );
  });

  it("ignores other errors", () => {
    assert.equal(
      professionalContactUniqueViolation({ code: "23505", message: "professionals_slug_unique_lower_idx" }),
      null,
    );
    assert.equal(professionalContactUniqueViolation({ code: "42501", message: "mobile_number" }), null);
    assert.equal(professionalContactUniqueViolation(null), null);
  });
});
