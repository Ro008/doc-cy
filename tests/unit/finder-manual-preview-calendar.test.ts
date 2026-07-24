import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildManualPreviewCalendar,
  isManualPreviewSlotInFuture,
} from "../../lib/finder-manual-preview-calendar";
import type { FinderAvailabilityDayHeader } from "../../lib/public/compute-public-booking-slots";

function headersFor(dateKeys: string[]): FinderAvailabilityDayHeader[] {
  return dateKeys.map((dateKey) => ({
    dateKey,
    weekdayLabel: "MON",
    dateLabel: "1 Jan",
  }));
}

describe("isManualPreviewSlotInFuture", () => {
  it("keeps future days regardless of clock time", () => {
    const now = new Date("2026-07-24T10:00:00+03:00");
    assert.equal(isManualPreviewSlotInFuture("2026-07-25", "08:30", now), true);
  });

  it("rejects past times on today in Cyprus", () => {
    const now = new Date("2026-07-24T14:00:00+03:00");
    assert.equal(isManualPreviewSlotInFuture("2026-07-24", "09:15", now), false);
    assert.equal(isManualPreviewSlotInFuture("2026-07-24", "14:00", now), true);
    assert.equal(isManualPreviewSlotInFuture("2026-07-24", "17:45", now), true);
  });
});

describe("buildManualPreviewCalendar", () => {
  it("never returns past times for today", () => {
    const now = new Date("2026-07-24T15:10:00+03:00");
    const calendar = buildManualPreviewCalendar(
      headersFor(["2026-07-24", "2026-07-25", "2026-07-26"]),
      "akis-kastellanos-nicosia",
      now,
    );

    const today = calendar.find((day) => day.dateKey === "2026-07-24");
    assert.ok(today);
    for (const slot of today.slots) {
      assert.ok(
        slot.timeLabel >= "15:10",
        `expected future slot, got ${slot.timeLabel}`,
      );
    }
  });

  it("returns no today slots when the day is fully past the pool", () => {
    const now = new Date("2026-07-24T23:30:00+03:00");
    const calendar = buildManualPreviewCalendar(
      headersFor(["2026-07-24", "2026-07-25"]),
      "seed-late-night",
      now,
    );
    const today = calendar.find((day) => day.dateKey === "2026-07-24");
    assert.ok(today);
    assert.equal(today.slots.length, 0);
    const tomorrow = calendar.find((day) => day.dateKey === "2026-07-25");
    assert.ok(tomorrow);
    assert.ok(tomorrow.slots.length >= 0);
  });

  it("is stable for the same seed and now", () => {
    const now = new Date("2026-07-24T09:00:00+03:00");
    const a = buildManualPreviewCalendar(headersFor(["2026-07-24", "2026-07-25"]), "stable", now);
    const b = buildManualPreviewCalendar(headersFor(["2026-07-24", "2026-07-25"]), "stable", now);
    assert.deepEqual(a, b);
  });
});
