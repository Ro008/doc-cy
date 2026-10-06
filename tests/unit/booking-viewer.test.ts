import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bookingViewerMode } from "../../lib/booking-viewer";

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
