import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicAvailabilityDay } from "../../lib/public/compute-public-booking-slots";
import {
  PROFILE_NEXT_AVAILABILITY_DAY_LIMIT,
  hasAvailabilityToday,
  summarizeNextAvailabilityDays,
} from "../../lib/public/profile-next-availability";
import {
  PROFILE_SELECT_DAY_EVENT,
  parseProfileDaySelectDetail,
} from "../../lib/public/profile-day-select";

function day(dateKey: string, times: string[], isToday = false): PublicAvailabilityDay {
  return {
    dateKey,
    weekdayLabel: "MON",
    dateLabel: "5 Oct",
    isToday,
    slots: times.map((timeLabel) => ({ slotKey: `${dateKey}T${timeLabel}`, timeLabel })),
  };
}

describe("summarizeNextAvailabilityDays", () => {
  it("lists only days with free times, each with its first time and slot count", () => {
    const summary = summarizeNextAvailabilityDays([
      day("2026-10-02", ["14:00", "15:30"], true),
      day("2026-10-03", []),
      day("2026-10-05", ["11:00"]),
    ]);
    assert.deepEqual(
      summary.map((d) => [d.dateKey, d.fromTime, d.slotCount, d.isToday]),
      [
        ["2026-10-02", "14:00", 2, true],
        ["2026-10-05", "11:00", 1, false],
      ],
    );
    assert.equal(summary[0].weekdayLabel, "MON");
    assert.equal(summary[0].dateLabel, "5 Oct");
  });

  it("stops at six days by default", () => {
    assert.equal(PROFILE_NEXT_AVAILABILITY_DAY_LIMIT, 6);
    const days = Array.from({ length: 10 }, (_, i) =>
      day(`2026-10-${String(10 + i)}`, ["09:00"]),
    );
    assert.equal(summarizeNextAvailabilityDays(days).length, 6);
    assert.equal(summarizeNextAvailabilityDays(days, 3).length, 3);
  });

  it("returns nothing when there is no free time (paused, holiday, no schedule)", () => {
    assert.deepEqual(summarizeNextAvailabilityDays([]), []);
    assert.deepEqual(summarizeNextAvailabilityDays([day("2026-10-02", [], true)]), []);
    assert.deepEqual(summarizeNextAvailabilityDays([day("2026-10-02", ["09:00"])], 0), []);
  });
});

describe("hasAvailabilityToday", () => {
  it("is true only when today itself still has a free time", () => {
    assert.equal(hasAvailabilityToday(summarizeNextAvailabilityDays([day("2026-10-02", ["18:00"], true)])), true);
    assert.equal(hasAvailabilityToday(summarizeNextAvailabilityDays([day("2026-10-03", ["09:00"])])), false);
    assert.equal(hasAvailabilityToday([]), false);
  });
});

describe("profile day select event", () => {
  it("has a namespaced event name", () => {
    assert.equal(PROFILE_SELECT_DAY_EVENT, "doccy:profile-select-day");
  });

  it("accepts only a yyyy-MM-dd date key", () => {
    assert.equal(parseProfileDaySelectDetail({ dateKey: "2026-10-05" }), "2026-10-05");
    for (const detail of [null, undefined, {}, { dateKey: "5 Oct" }, { dateKey: "2026-10-05T09:00" }, "2026-10-05"]) {
      assert.equal(parseProfileDaySelectDetail(detail), null);
    }
  });
});
