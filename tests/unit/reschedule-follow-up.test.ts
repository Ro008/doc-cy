import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NO_NEW_TIME_DISMISSED_KEY,
  isRescheduleWithoutAnswer,
  parseDismissedIds,
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
    status: "EXPIRED",
    proposal_expires_at: new Date(NOW - HOUR).toISOString(),
    appointment_datetime: "2026-09-29T12:00:00.000Z", // Tue 29 Sep, 15:00 Cyprus
    patient_name: "Anastasia",
    ...over,
  };
}

/**
 * A proposal the patient let lapse (user, 2026-10-04): the scheduled job stores plain EXPIRED
 * (no RESCHEDULE_EXPIRED); proposal_expires_at tells it apart from an unanswered request.
 * Listed quietly on her dashboard with only "Close", which hides it on this device.
 */
describe("isRescheduleWithoutAnswer", () => {
  it("is true for a lapsed proposal stored as EXPIRED", () => {
    assert.equal(isRescheduleWithoutAnswer(row(), NOW), true);
  });

  it("is true for a lapsed NEEDS_RESCHEDULE row the job hasn't closed yet", () => {
    assert.equal(isRescheduleWithoutAnswer(row({ status: "NEEDS_RESCHEDULE" }), NOW), true);
  });

  it("is false while the patient can still choose", () => {
    assert.equal(
      isRescheduleWithoutAnswer(
        row({ status: "NEEDS_RESCHEDULE", proposal_expires_at: new Date(NOW + HOUR).toISOString() }),
        NOW,
      ),
      false,
    );
  });

  it("is false for an unanswered request that expired (no proposal)", () => {
    assert.equal(isRescheduleWithoutAnswer(row({ proposal_expires_at: null }), NOW), false);
  });

  it("is false for other statuses", () => {
    for (const status of ["REQUESTED", "CONFIRMED", "CANCELLED", "DECLINED"]) {
      assert.equal(isRescheduleWithoutAnswer(row({ status }), NOW), false);
    }
  });

  it("ignores lapses older than two weeks", () => {
    assert.equal(
      isRescheduleWithoutAnswer(row({ proposal_expires_at: new Date(NOW - 15 * 24 * HOUR).toISOString() }), NOW),
      false,
    );
  });
});

describe("selectRescheduleWithoutAnswer", () => {
  it("keeps only lapsed proposals, the one that expired first on top", () => {
    const rows = [
      row({ id: "late", proposal_expires_at: new Date(NOW - HOUR).toISOString() }),
      row({ id: "live", status: "NEEDS_RESCHEDULE", proposal_expires_at: new Date(NOW + HOUR).toISOString() }),
      row({ id: "early", proposal_expires_at: new Date(NOW - 5 * HOUR).toISOString() }),
      row({ id: "confirmed", status: "CONFIRMED" }),
    ];
    assert.deepEqual(
      selectRescheduleWithoutAnswer(rows, NOW).map((r) => r.id),
      ["early", "late"],
    );
  });

  it("leaves out the ones she closed", () => {
    const rows = [row({ id: "x" }), row({ id: "y" })];
    assert.deepEqual(
      selectRescheduleWithoutAnswer(rows, NOW, new Set(["x"])).map((r) => r.id),
      ["y"],
    );
  });
});

describe("parseDismissedIds", () => {
  it("reads a stored JSON list of ids", () => {
    assert.deepEqual([...parseDismissedIds('["a","b"]')], ["a", "b"]);
  });

  it("is empty for missing or broken values", () => {
    for (const raw of [null, "", "nope", "{}", "[1,2]"]) {
      assert.equal(parseDismissedIds(raw).size, 0, String(raw));
    }
  });

  it("has a stable storage key", () => {
    assert.equal(NO_NEW_TIME_DISMISSED_KEY, "doccy:dashboard:no-new-time-dismissed");
  });
});

describe("rescheduleWithoutAnswerSummary", () => {
  it("names the original visit and when the offer expired (Cyprus time)", () => {
    assert.deepEqual(rescheduleWithoutAnswerSummary(row()), {
      originalLabel: "Tue 29 Sep, 15:00",
      expiredLabel: "Tue 29 Sep, 11:00",
    });
  });
});
