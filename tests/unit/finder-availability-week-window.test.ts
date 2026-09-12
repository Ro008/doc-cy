import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeFinderCardAvailabilityWeekState,
  snapWindowStartToDayIndex,
} from "@/lib/public/finder-availability-week-window";

function day(slotCount: number, dateLabel: string) {
  return { slots: Array.from({ length: slotCount }, () => ({})), dateLabel };
}

describe("computeFinderCardAvailabilityWeekState", () => {
  it("is no-availability-in-window when nothing has slots anywhere", () => {
    const days = [day(0, "12 Sep"), day(0, "13 Sep"), day(0, "14 Sep")];
    assert.deepEqual(computeFinderCardAvailabilityWeekState(days, 0, 2), {
      kind: "no-availability-in-window",
    });
  });

  it("is has-slots when the visible week has at least one slot", () => {
    const days = [day(2, "12 Sep"), day(0, "13 Sep"), day(0, "14 Sep")];
    assert.deepEqual(computeFinderCardAvailabilityWeekState(days, 0, 2), {
      kind: "has-slots",
    });
  });

  it("finds the next available day forward from the current window when this week is empty", () => {
    const days = [day(0, "12 Sep"), day(0, "13 Sep"), day(3, "14 Sep"), day(0, "15 Sep")];
    assert.deepEqual(computeFinderCardAvailabilityWeekState(days, 0, 2), {
      kind: "no-slots-this-week",
      nextAvailableDayIndex: 2,
      nextAvailableDateLabel: "14 Sep",
    });
  });

  it("does not point backward when the only slot is behind the current window", () => {
    const days = [day(3, "12 Sep"), day(0, "13 Sep"), day(0, "14 Sep"), day(0, "15 Sep")];
    assert.deepEqual(computeFinderCardAvailabilityWeekState(days, 2, 2), {
      kind: "no-slots-this-week",
      nextAvailableDayIndex: null,
      nextAvailableDateLabel: null,
    });
  });

  it("ignores slots before the currently visible week when picking the next day", () => {
    const days = [
      day(3, "12 Sep"),
      day(0, "13 Sep"),
      day(0, "14 Sep"),
      day(0, "15 Sep"),
      day(4, "16 Sep"),
    ];
    assert.deepEqual(computeFinderCardAvailabilityWeekState(days, 1, 2), {
      kind: "no-slots-this-week",
      nextAvailableDayIndex: 4,
      nextAvailableDateLabel: "16 Sep",
    });
  });
});

describe("snapWindowStartToDayIndex", () => {
  it("snaps down to the start of the 5-day page containing the index", () => {
    assert.equal(snapWindowStartToDayIndex(17, 5, 85), 15);
    assert.equal(snapWindowStartToDayIndex(15, 5, 85), 15);
    assert.equal(snapWindowStartToDayIndex(0, 5, 85), 0);
  });

  it("clamps to the max window start", () => {
    assert.equal(snapWindowStartToDayIndex(89, 5, 85), 85);
  });

  it("clamps negative indexes to zero", () => {
    assert.equal(snapWindowStartToDayIndex(-3, 5, 85), 0);
  });
});
