import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_LIMITS,
  DRAFT_CONFIRM_IN_FLIGHT_MS,
  bookingLimitRefusal,
  draftLinkState,
  escapeIlikeExact,
} from "../../lib/appointment-drafts";

/**
 * Online booking requests wait as drafts until the patient clicks the emailed link
 * (30 min, single use). Limits (user, 2026-10-02): per email and per phone, and one
 * open request per email per professional.
 */
describe("bookingLimitRefusal", () => {
  const ok = { draftsLastHourForEmail: 0, draftsLastHourForPhone: 0, openRequestsWithProfessional: 0 };

  it("allows a first request", () => {
    assert.equal(bookingLimitRefusal(ok), null);
  });

  it("allows up to the hourly limit per email and per phone, not beyond", () => {
    assert.equal(bookingLimitRefusal({ ...ok, draftsLastHourForEmail: BOOKING_LIMITS.draftsPerEmailPerHour - 1 }), null);
    assert.equal(
      bookingLimitRefusal({ ...ok, draftsLastHourForEmail: BOOKING_LIMITS.draftsPerEmailPerHour })?.code,
      "too_many_requests",
    );
    assert.equal(
      bookingLimitRefusal({ ...ok, draftsLastHourForPhone: BOOKING_LIMITS.draftsPerPhonePerHour })?.code,
      "too_many_requests",
    );
  });

  it("refuses a second open request with the same professional", () => {
    const refusal = bookingLimitRefusal({ ...ok, openRequestsWithProfessional: 1 });
    assert.equal(refusal?.code, "open_request_exists");
    assert.match(refusal?.message ?? "", /already/i);
  });
});

describe("draftLinkState", () => {
  const now = new Date("2026-10-05T10:00:00Z");

  it("is usable before it expires and while unused", () => {
    assert.equal(draftLinkState({ expires_at: "2026-10-05T10:29:00Z", confirmed_at: null }, now), "usable");
  });

  it("is used once confirmed", () => {
    assert.equal(
      draftLinkState({ expires_at: "2026-10-05T10:29:00Z", confirmed_at: "2026-10-05T09:59:00Z" }, now),
      "used",
    );
  });

  it("is expired from its expiry time on", () => {
    assert.equal(draftLinkState({ expires_at: "2026-10-05T10:00:00Z", confirmed_at: null }, now), "expired");
  });

  it("is invalid when there is no draft", () => {
    assert.equal(draftLinkState(null, now), "invalid");
  });

  // A confirm refused before the request was created (time taken) leaves no appointment:
  // that link must not read as "already confirmed" (manual test B5, user 2026-10-06).
  it("is unbooked when marked confirmed but no request was created", () => {
    assert.equal(
      draftLinkState({ expires_at: "2026-10-05T10:29:00Z", confirmed_at: "2026-10-05T09:50:00Z", appointment_id: null }, now),
      "unbooked",
    );
    assert.equal(
      draftLinkState(
        { expires_at: "2026-10-05T10:29:00Z", confirmed_at: "2026-10-05T09:59:00Z", appointment_id: "a-1" },
        now,
      ),
      "used",
    );
  });

  // The confirm button marks the link used first and creates the request a few seconds later.
  // Opening the link in between must not say "This request wasn't sent" while the request is
  // on its way to the professional (manual test D1, user 2026-10-07).
  it("reads as already confirmed while the request is still being created", () => {
    const confirmedAt = new Date(now.getTime() - 10_000).toISOString();
    assert.equal(
      draftLinkState({ expires_at: "2026-10-05T10:29:00Z", confirmed_at: confirmedAt, appointment_id: null }, now),
      "used",
    );
  });

  it("is unbooked once that short wait is over and still no request exists", () => {
    const confirmedAt = new Date(now.getTime() - DRAFT_CONFIRM_IN_FLIGHT_MS - 1).toISOString();
    assert.equal(
      draftLinkState({ expires_at: "2026-10-05T10:29:00Z", confirmed_at: confirmedAt, appointment_id: null }, now),
      "unbooked",
    );
  });

  // Sending the form again replaces the earlier unconfirmed draft (user, 2026-10-05).
  it("is replaced when a newer draft exists, whether or not its time ran out", () => {
    const replaced = { newerDraftExists: true };
    assert.equal(draftLinkState({ expires_at: "2026-10-05T10:29:00Z", confirmed_at: null }, now, replaced), "replaced");
    assert.equal(draftLinkState({ expires_at: "2026-10-05T09:00:00Z", confirmed_at: null }, now, replaced), "replaced");
  });

  it("stays used once confirmed, even with a newer draft", () => {
    assert.equal(
      draftLinkState(
        { expires_at: "2026-10-05T10:29:00Z", confirmed_at: "2026-10-05T09:59:00Z" },
        now,
        { newerDraftExists: true },
      ),
      "used",
    );
  });
});

describe("escapeIlikeExact", () => {
  it("escapes the ILIKE wildcards so an email matches only itself", () => {
    assert.equal(escapeIlikeExact("first_last%x@example.com"), "first\\_last\\%x@example.com");
    assert.equal(escapeIlikeExact("a\\b@example.com"), "a\\\\b@example.com");
  });
});
