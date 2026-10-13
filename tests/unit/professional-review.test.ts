import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REVIEW_COMMENT_MAX,
  REVIEW_LINK_DAYS,
  parseReviewSubmission,
  reviewEligibility,
} from "../../lib/professional-review";
import { buildPatientReviewRequestEmail } from "../../lib/review-request-email";

/**
 * Verified reviews (user, 2026-10-04): one per attended visit, from the emailed link (single
 * use, ~30 days); the typed email must match the visit's; rating 1-5 and a written review;
 * shown as "Maria K.", the email never.
 */
describe("parseReviewSubmission", () => {
  const visitEmail = "Maria@Example.com";
  const good = { rating: 5, comment: "  Very kind and thorough.  ", email: " maria@example.com " };

  it("accepts a rating, a comment and the visit's email (any case)", () => {
    assert.deepEqual(parseReviewSubmission(good, visitEmail), {
      ok: true,
      rating: 5,
      comment: "Very kind and thorough.",
      email: "maria@example.com",
    });
  });

  it("needs a whole rating from 1 to 5", () => {
    for (const rating of [0, 6, 3.5, "4", null, undefined]) {
      const r = parseReviewSubmission({ ...good, rating }, visitEmail);
      assert.equal(r.ok, false, String(rating));
      assert.equal(r.code, "rating");
    }
  });

  it("needs a written review up to 2,000 characters", () => {
    assert.equal(REVIEW_COMMENT_MAX, 2000);
    assert.equal(parseReviewSubmission({ ...good, comment: "   " }, visitEmail).code, "comment");
    assert.equal(parseReviewSubmission({ ...good, comment: "a".repeat(2001) }, visitEmail).code, "comment");
    assert.equal(parseReviewSubmission({ ...good, comment: "a".repeat(2000) }, visitEmail).ok, true);
  });

  it("refuses an email that isn't the one the visit was booked with", () => {
    assert.equal(parseReviewSubmission({ ...good, email: "other@example.com" }, visitEmail).code, "email_mismatch");
    assert.equal(parseReviewSubmission({ ...good, email: "" }, visitEmail).code, "email_mismatch");
    assert.equal(parseReviewSubmission(good, null).code, "email_mismatch");
  });
});

describe("reviewEligibility", () => {
  it("is open for a confirmed visit that wasn't a no-show", () => {
    assert.equal(reviewEligibility({ status: "CONFIRMED", attendance: "attended" }), "ok");
    assert.equal(reviewEligibility({ status: "CONFIRMED", attendance: null }), "ok");
  });

  it("is closed for a no-show or a visit that didn't happen", () => {
    assert.equal(reviewEligibility({ status: "CONFIRMED", attendance: "no_show" }), "no_show");
    for (const status of ["CANCELLED", "DECLINED", "EXPIRED", "REQUESTED"]) {
      assert.equal(reviewEligibility({ status, attendance: null }), "not_visited", status);
    }
  });
});

describe("buildPatientReviewRequestEmail", () => {
  const email = buildPatientReviewRequestEmail({
    patientName: "Maria Kyriakou",
    professionalName: "Dr. Andreas Nikos",
    appointmentIso: "2026-10-07T07:00:00Z",
    reviewUrl: "https://www.mydoccy.com/booking/review?token=abc",
  });

  it("asks for a review with the link, naming the professional and the visit day", () => {
    assert.ok(email.subject.includes("Andreas"));
    for (const body of [email.text, email.html]) {
      assert.ok(body.includes("https://www.mydoccy.com/booking/review?token=abc"));
      assert.ok(body.includes("Wednesday, 7 October 2026"));
      assert.ok(body.includes("Maria"));
    }
  });

  it("says how the name will appear and how long the link works", () => {
    assert.equal(REVIEW_LINK_DAYS, 30);
    assert.ok(email.text.includes("Maria K."));
    assert.match(email.text, /30 days/);
  });
});
