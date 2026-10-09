import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bookingViewerMode, isBlockedFromBooking } from "../../lib/booking-viewer";

/**
 * A signed-in professional can't book, with anyone (user, 2026-10-06). Applicants count
 * as professionals; founders and signed-out visitors book as patients.
 */
describe("bookingViewerMode", () => {
  it("signed out, or an account with no profile or application (founders): patient", () => {
    assert.equal(bookingViewerMode(null, false), "patient");
    assert.equal(bookingViewerMode("none", false), "patient");
  });

  it("a professional on her own profile sees her own-profile note", () => {
    assert.equal(bookingViewerMode("professional", true), "own_profile");
  });

  it("a professional or an applicant on a colleague's profile can't book", () => {
    assert.equal(bookingViewerMode("professional", false), "professional");
    assert.equal(bookingViewerMode("applicant", false), "professional");
  });
});

/** A stand-in for the service client: `professionals` answers with `row` or `error`. */
function fakeService(result: { data: { id: string } | null; error: { message: string } | null }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
  };
  return { from: () => chain } as never;
}

describe("isBlockedFromBooking", () => {
  it("signed out: not blocked", async () => {
    assert.equal(await isBlockedFromBooking(fakeService({ data: null, error: null }), null), false);
  });

  it("a signed-in professional is blocked", async () => {
    assert.equal(await isBlockedFromBooking(fakeService({ data: { id: "p1" }, error: null }), "user-1"), true);
  });

  it("fails open when the lookup breaks, so a patient is never locked out by an error", async () => {
    assert.equal(
      await isBlockedFromBooking(fakeService({ data: null, error: { message: "boom" } }), "user-1"),
      false,
    );
  });
});
