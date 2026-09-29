import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RESCHEDULE_EXPIRED_STATUS,
  askedForAnotherTimeLabel,
  isRescheduleWithoutAnswer,
  rescheduleWithoutAnswerSummary,
  selectRescheduleWithoutAnswer,
} from "../../lib/reschedule-follow-up";

const NOW = new Date("2026-09-29T09:00:00.000Z").getTime(); // 12:00 Cyprus
const HOUR = 60 * 60 * 1000;

function row(over: Partial<{
  id: string;
  status: string | null;
  proposal_expires_at: string | null;
  appointment_datetime: string;
  patient_name: string | null;
}> = {}) {
  return {
    id: "a",
    status: "NEEDS_RESCHEDULE",
    proposal_expires_at: new Date(NOW - HOUR).toISOString(),
    appointment_datetime: "2026-09-29T12:00:00.000Z", // Tue 29 Sep, 15:00 Cyprus
    patient_name: "Anastasia",
    ...over,
  };
}

describe("isRescheduleWithoutAnswer", () => {
  it("is true for the stored final status the backend will set", () => {
    assert.equal(RESCHEDULE_EXPIRED_STATUS, "RESCHEDULE_EXPIRED");
    assert.equal(isRescheduleWithoutAnswer(row({ status: "RESCHEDULE_EXPIRED", proposal_expires_at: null }), NOW), true);
  });

  it("is true for a proposal that expired without a choice (until the backend stores the status)", () => {
    assert.equal(isRescheduleWithoutAnswer(row(), NOW), true);
  });

  it("is false while the patient can still choose", () => {
    assert.equal(
      isRescheduleWithoutAnswer(row({ proposal_expires_at: new Date(NOW + HOUR).toISOString() }), NOW),
      false,
    );
  });

  it("is false for other statuses", () => {
    for (const status of ["REQUESTED", "CONFIRMED", "CANCELLED", "EXPIRED"]) {
      assert.equal(isRescheduleWithoutAnswer(row({ status }), NOW), false);
    }
  });

  it("ignores lapsed proposals older than two weeks (old rows the backend never closed)", () => {
    assert.equal(
      isRescheduleWithoutAnswer(row({ proposal_expires_at: new Date(NOW - 15 * 24 * HOUR).toISOString() }), NOW),
      false,
    );
  });
});

describe("selectRescheduleWithoutAnswer", () => {
  it("keeps only rows without an answer, the one that expired first on top", () => {
    const rows = [
      row({ id: "late", proposal_expires_at: new Date(NOW - HOUR).toISOString() }),
      row({ id: "live", proposal_expires_at: new Date(NOW + HOUR).toISOString() }),
      row({ id: "early", proposal_expires_at: new Date(NOW - 5 * HOUR).toISOString() }),
      row({ id: "confirmed", status: "CONFIRMED" }),
    ];
    assert.deepEqual(
      selectRescheduleWithoutAnswer(rows, NOW).map((r) => r.id),
      ["early", "late"],
    );
  });
});

describe("rescheduleWithoutAnswerSummary", () => {
  it("names the original visit and when the offer expired (Cyprus time)", () => {
    assert.deepEqual(rescheduleWithoutAnswerSummary(row()), {
      originalLabel: "Tue 29 Sep, 15:00",
      expiredLabel: "Tue 29 Sep, 11:00",
    });
  });

  it("leaves the expiry out when unknown", () => {
    assert.equal(
      rescheduleWithoutAnswerSummary(row({ status: "RESCHEDULE_EXPIRED", proposal_expires_at: null })).expiredLabel,
      null,
    );
  });
});

describe("askedForAnotherTimeLabel", () => {
  it("says which visit the patient moved away from", () => {
    assert.equal(
      askedForAnotherTimeLabel({ rescheduled_from: "2026-09-29T12:00:00.000Z" }),
      "Asked for another time · was Tue 29 Sep, 15:00",
    );
  });

  it("is null for an ordinary request", () => {
    assert.equal(askedForAnotherTimeLabel({ rescheduled_from: null }), null);
    assert.equal(askedForAnotherTimeLabel({}), null);
  });
});
