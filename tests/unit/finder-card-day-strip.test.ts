import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_DAY_STRIP_DAY_COUNT,
  finderDayStripCircles,
  finderDayStripLongDate,
  finderDayStripShortDate,
  finderDayStripState,
  finderDayStripTimeGrid,
  finderDayStripWeekStart,
} from "../../lib/finder-card-day-strip";

/** 14 days from Friday 16 October 2026 (Cyprus), as `buildFinderAvailabilityDayHeaders` makes them. */
const headers = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 16 + i));
  const key = d.toISOString().slice(0, 10);
  return {
    dateKey: key,
    weekdayLabel: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getUTCDay()]!,
    dateLabel: `${d.getUTCDate()} Oct`,
    isToday: i === 0,
  };
});

const slot = (time: string) => ({ slotKey: `k-${time}`, timeLabel: time });
/** Her calendar: times on the given day offsets only. */
function calendar(timesByOffset: Record<number, string[]>, length = 14) {
  return headers.slice(0, length).map((h, i) => ({ ...h, slots: (timesByOffset[i] ?? []).map(slot) }));
}

describe("G's day circles (Finder G, step 4)", () => {
  it("a week of seven days, today first", () => {
    assert.equal(FINDER_DAY_STRIP_DAY_COUNT, 7);
    const circles = finderDayStripCircles(headers, calendar({ 1: ["09:00"] }), 0);
    assert.equal(circles.length, 7);
    assert.deepEqual(
      circles.map((c) => c.label),
      ["TODAY", "SAT", "SUN", "MON", "TUE", "WED", "THU"],
    );
    assert.deepEqual(circles.map((c) => c.dayNumber), [16, 17, 18, 19, 20, 21, 22]);
    assert.deepEqual(circles.map((c) => c.index), [0, 1, 2, 3, 4, 5, 6]);
  });

  it("marks the days that have free times at this clinic", () => {
    const circles = finderDayStripCircles(headers, calendar({ 1: ["09:00"], 4: ["10:30"] }), 0);
    assert.deepEqual(
      circles.map((c) => c.hasTimes),
      [false, true, false, false, true, false, false],
    );
  });

  it("the next week starts on day 7 and says the weekday, not TODAY", () => {
    const circles = finderDayStripCircles(headers, calendar({ 7: ["09:00"] }), 7);
    assert.equal(circles[0]!.label, "FRI");
    assert.equal(circles[0]!.dayNumber, 23);
    assert.equal(circles[0]!.hasTimes, true);
  });

  it("a calendar shorter than the list (her booking horizon) has no times after it", () => {
    const circles = finderDayStripCircles(headers, calendar({ 1: ["09:00"] }, 3), 0);
    assert.equal(circles.length, 7);
    assert.deepEqual(circles.slice(3).map((c) => c.hasTimes), [false, false, false, false]);
  });

  it("writes the day as the profile does: 'Saturday, 17 October'", () => {
    assert.equal(finderDayStripLongDate(headers[1]!.dateKey), "Saturday, 17 October");
    assert.equal(finderDayStripShortDate(headers[3]!.dateKey), "Mon 19 Oct");
  });

  it("a chosen day snaps the week to the one that holds it", () => {
    assert.equal(finderDayStripWeekStart(0), 0);
    assert.equal(finderDayStripWeekStart(6), 0);
    assert.equal(finderDayStripWeekStart(9), 7);
  });
});

describe("what a card shows under the circles", () => {
  it("the chosen day's times", () => {
    const state = finderDayStripState(calendar({ 1: ["09:00", "09:45"] }), 1);
    assert.equal(state.kind, "times");
    assert.deepEqual(state.kind === "times" ? state.slots.map((s) => s.timeLabel) : [], ["09:00", "09:45"]);
  });

  it("no times that day: the next free day, from the chosen one on", () => {
    const state = finderDayStripState(calendar({ 0: ["08:00"], 3: ["10:30"] }), 1);
    assert.deepEqual(state, { kind: "none-this-day", nextFreeIndex: 3 });
  });

  it("nothing from the chosen day on, but earlier times: none in the window", () => {
    assert.deepEqual(finderDayStripState(calendar({ 0: ["08:00"] }), 2), { kind: "none-ahead" });
  });

  it("no times at all in her calendar", () => {
    assert.deepEqual(finderDayStripState(calendar({}), 0), { kind: "none-ahead" });
    assert.deepEqual(finderDayStripState([], 0), { kind: "none-ahead" });
  });
});

describe("G's stacked times (Finder G, step 4; user, 2026-10-16)", () => {
  it("two rows on the left: five a row from sm, four on a phone", () => {
    const grid = finderDayStripTimeGrid(3);
    assert.deepEqual(grid, {
      rendered: 3,
      phone: { times: 3, allTimes: false },
      wide: { times: 3, allTimes: false },
    });
  });

  it("every time shows while they fit, with no All times", () => {
    // Three rows (mockup L): 4 a row on a phone, 6 a row from sm.
    assert.deepEqual(finderDayStripTimeGrid(12).phone, { times: 12, allTimes: false });
    assert.deepEqual(finderDayStripTimeGrid(18).wide, { times: 18, allTimes: false });
  });

  it("when they no longer fit, the last cell is All times", () => {
    const thirteen = finderDayStripTimeGrid(13);
    assert.deepEqual(thirteen.phone, { times: 11, allTimes: true });
    assert.deepEqual(thirteen.wide, { times: 13, allTimes: false });
    const many = finderDayStripTimeGrid(20);
    assert.equal(many.rendered, 17);
    assert.deepEqual(many.phone, { times: 11, allTimes: true });
    assert.deepEqual(many.wide, { times: 17, allTimes: true });
  });

  it("no times, nothing rendered", () => {
    assert.deepEqual(finderDayStripTimeGrid(0), {
      rendered: 0,
      phone: { times: 0, allTimes: false },
      wide: { times: 0, allTimes: false },
    });
  });
});
