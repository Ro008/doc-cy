import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateBookingRequestStats,
  FINDER_BOOKING_REQUEST_WINDOW_DAYS,
  finderBookingRequestWindowSinceIso,
  formatFinderRequestBadgeLabel,
} from "@/lib/finder-booking-request-stats";

describe("finder booking request stats", () => {
  it("uses a rolling 30-day window", () => {
    assert.equal(FINDER_BOOKING_REQUEST_WINDOW_DAYS, 30);
    const now = Date.parse("2026-09-02T12:00:00.000Z");
    assert.equal(
      finderBookingRequestWindowSinceIso(now),
      new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("counts every tap for ranking and unique patients for the badge", () => {
    const stats = aggregateBookingRequestStats([
      { professionalId: "a", id: "1", voterKey: "voter-1" },
      { professionalId: "a", id: "2", voterKey: "voter-1" },
      { professionalId: "a", id: "3", voterKey: "voter-2" },
      { professionalId: "b", id: "4", voterKey: null },
    ]);
    assert.deepEqual(stats.get("a"), { requests30d: 3, uniquePatients30d: 2 });
    assert.deepEqual(stats.get("b"), { requests30d: 1, uniquePatients30d: 1 });
  });

  it("formats the scarcity badge and hides zero", () => {
    assert.equal(formatFinderRequestBadgeLabel(0), null);
    assert.equal(
      formatFinderRequestBadgeLabel(1),
      "🔥 1 patient requested online booking this month",
    );
    assert.equal(
      formatFinderRequestBadgeLabel(4),
      "🔥 4 patients requested online booking this month",
    );
  });
});
