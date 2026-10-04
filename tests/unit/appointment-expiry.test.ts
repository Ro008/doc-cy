import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isExpiredRequest } from "../../lib/appointment-status";
import { buildPracticeInsights } from "../../lib/practice-insights";

const NOW = Date.parse("2026-09-27T09:00:00Z"); // 12:00 in Cyprus

describe("isExpiredRequest", () => {
  it("is expired once stored as EXPIRED (future backend status)", () => {
    assert.equal(isExpiredRequest({ status: "EXPIRED", startIso: "2026-10-05T09:00:00Z" }, NOW), true);
    assert.equal(isExpiredRequest({ status: "expired", startIso: "2026-10-05T09:00:00Z" }, NOW), true);
  });

  it("treats an unanswered request as expired once its visit time has started", () => {
    assert.equal(isExpiredRequest({ status: "REQUESTED", startIso: "2026-09-24T06:00:00Z" }, NOW), true);
    assert.equal(isExpiredRequest({ status: "REQUESTED", startIso: "2026-09-27T09:00:00Z" }, NOW), true);
    assert.equal(isExpiredRequest({ status: "REQUESTED", startIso: "2026-09-27T09:30:00Z" }, NOW), false);
  });

  it("never marks other states as expired", () => {
    for (const status of ["CONFIRMED", "CANCELLED", "NEEDS_RESCHEDULE", null]) {
      assert.equal(isExpiredRequest({ status, startIso: "2026-09-24T06:00:00Z" }, NOW), false, String(status));
    }
  });
});

describe("buildPracticeInsights with expired requests", () => {
  const base = {
    created_at: "2026-09-20T08:00:00Z",
    is_new_patient: true,
    attendance: null,
    duration_minutes: 30,
  };

  it("does not count unanswered past requests or EXPIRED rows as bookings", () => {
    const insights = buildPracticeInsights(
      [
        { ...base, status: "CONFIRMED", appointment_datetime: "2026-09-24T06:00:00Z" },
        { ...base, status: "REQUESTED", appointment_datetime: "2026-10-02T06:00:00Z" }, // still open
        { ...base, status: "REQUESTED", appointment_datetime: "2026-09-24T07:00:00Z" }, // expired
        { ...base, status: "EXPIRED", appointment_datetime: "2026-09-25T07:00:00Z" },
      ],
      null,
      new Date(NOW),
    );
    assert.equal(insights.totalBookingsThisMonth, 2);
    assert.equal(insights.newPatientsCapturedThisMonth, 2);
  });

  it("counts a live counter-offer but not one the patient let expire", () => {
    const insights = buildPracticeInsights(
      [
        { ...base, status: "CONFIRMED", appointment_datetime: "2026-09-24T06:00:00Z" },
        {
          ...base,
          status: "NEEDS_RESCHEDULE",
          appointment_datetime: "2026-10-02T06:00:00Z",
          proposal_expires_at: "2026-09-28T06:00:00Z", // still live
        },
        {
          ...base,
          status: "NEEDS_RESCHEDULE",
          appointment_datetime: "2026-09-28T09:00:00Z",
          proposal_expires_at: "2026-09-26T06:00:00Z", // expired
        },
        { ...base, status: "NEEDS_RESCHEDULE", appointment_datetime: "2026-09-29T09:00:00Z", proposal_expires_at: null },
      ],
      null,
      new Date(NOW),
    );
    assert.equal(insights.totalBookingsThisMonth, 2);
    assert.equal(insights.newPatientsCapturedThisMonth, 2);
  });
});
