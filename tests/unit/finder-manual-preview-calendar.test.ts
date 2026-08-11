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
    assert.ok(tomorrow.slots.length >= 2);
  });

  it("always seeds slots into the first visible week strip", () => {
    const now = new Date("2026-08-11T18:00:00+03:00");
    const dateKeys = Array.from({ length: 14 }, (_, i) => {
      const day = 11 + i;
      return `2026-08-${String(day).padStart(2, "0")}`;
    });
    const headers = headersFor(dateKeys);

    for (let i = 0; i < 40; i += 1) {
      const calendar = buildManualPreviewCalendar(headers, `listing-seed-${i}`, now);
      const firstWindowSlots = calendar
        .slice(0, 5)
        .reduce((sum, day) => sum + day.slots.length, 0);
      assert.ok(
        firstWindowSlots >= 2,
        `seed listing-seed-${i} left first window empty (${firstWindowSlots} slots)`,
      );
    }
  });

  it("is stable for the same seed and now", () => {
    const now = new Date("2026-07-24T09:00:00+03:00");
    const a = buildManualPreviewCalendar(headersFor(["2026-07-24", "2026-07-25"]), "stable", now);
    const b = buildManualPreviewCalendar(headersFor(["2026-07-24", "2026-07-25"]), "stable", now);
    assert.deepEqual(a, b);
  });
});
