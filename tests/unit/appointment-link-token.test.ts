import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  APPOINTMENT_LINK_PATHS,
  appointmentLinkUrl,
  BOOKING_CONFIRM_LINK_MINUTES,
  hashAppointmentLinkToken,
  isAppointmentLinkTokenShape,
  newAppointmentLinkToken,
} from "../../lib/appointment-link-token";

/**
 * Links emailed to patients (confirm a booking request, pick a proposed time, cancel,
 * review). Only the SHA-256 of the token is stored (appointment_drafts.token_hash,
 * appointment_links.token_hash); the raw token travels only in the email.
 */
describe("newAppointmentLinkToken", () => {
  it("is a long, URL-safe random string", () => {
    const token = newAppointmentLinkToken();
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 200 }, () => newAppointmentLinkToken()));
    assert.equal(seen.size, 200);
  });
});

describe("hashAppointmentLinkToken", () => {
  it("is the hex SHA-256 of the token", () => {
    const token = "abc";
    assert.equal(hashAppointmentLinkToken(token), createHash("sha256").update(token).digest("hex"));
  });

  it("differs from the token and is stable", () => {
    const token = newAppointmentLinkToken();
    assert.notEqual(hashAppointmentLinkToken(token), token);
    assert.equal(hashAppointmentLinkToken(token), hashAppointmentLinkToken(token));
  });
});

describe("isAppointmentLinkTokenShape", () => {
  it("accepts a generated token", () => {
    assert.equal(isAppointmentLinkTokenShape(newAppointmentLinkToken()), true);
  });

  it("rejects empty, short, too long or non-URL-safe values", () => {
    for (const bad of ["", "abc", "x".repeat(200), "a".repeat(42) + "=", "a b".repeat(15), null, undefined, 42]) {
      assert.equal(isAppointmentLinkTokenShape(bad), false, String(bad));
    }
  });
});

describe("appointmentLinkUrl", () => {
  it("builds the patient page URL for each purpose, token in the query", () => {
    assert.equal(
      appointmentLinkUrl("https://www.mydoccy.com/", "confirm", "tok_1"),
      "https://www.mydoccy.com/booking/confirm?token=tok_1",
    );
    assert.equal(
      appointmentLinkUrl("https://www.mydoccy.com", "proposal", "tok_2"),
      "https://www.mydoccy.com/booking/choose?token=tok_2",
    );
    assert.equal(
      appointmentLinkUrl("https://www.mydoccy.com", "cancel", "tok_3"),
      "https://www.mydoccy.com/booking/cancel?token=tok_3",
    );
    assert.equal(
      appointmentLinkUrl("https://www.mydoccy.com", "review", "tok_4"),
      "https://www.mydoccy.com/review?token=tok_4",
    );
  });

  it("encodes the token", () => {
    assert.equal(
      appointmentLinkUrl("https://x.test", "cancel", "a+b/c"),
      "https://x.test/booking/cancel?token=a%2Bb%2Fc",
    );
  });

  it("has one path per purpose", () => {
    assert.deepEqual(Object.keys(APPOINTMENT_LINK_PATHS).sort(), ["cancel", "confirm", "proposal", "review"]);
  });
});

describe("booking confirmation link", () => {
  it("lasts 30 minutes (user, 2026-10-02)", () => {
    assert.equal(BOOKING_CONFIRM_LINK_MINUTES, 30);
  });
});
