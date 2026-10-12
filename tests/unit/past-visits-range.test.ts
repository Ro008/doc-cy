import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  activeRangePreset,
  dateToDayKey,
  dayKeyToDate,
  rangeLabel,
  rangePresets,
} from "../../lib/past-visits-range";

/**
 * The Visits tab's date-range picker (user, 2026-10-12): a branded calendar with shortcuts
 * instead of the browser's two date inputs. Days are Cyprus calendar days as YYYY-MM-DD.
 */
describe("dayKeyToDate / dateToDayKey", () => {
  it("round-trips a day without shifting it, whatever the time zone", () => {
    for (const key of ["2026-10-12", "2026-01-01", "2026-12-31", "2026-03-29"]) {
      assert.equal(dateToDayKey(dayKeyToDate(key)), key);
    }
  });

  it("builds a local date for that day", () => {
    const d = dayKeyToDate("2026-10-12");
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 9, 12]);
  });
});

describe("rangePresets", () => {
  const today = "2026-10-12"; // a Monday
  const byId = (id: string) => rangePresets(today).find((p) => p.id === id)!;

  it("offers the usual shortcuts in order", () => {
    assert.deepEqual(
      rangePresets(today).map((p) => [p.id, p.label]),
      [
        ["last7", "Last 7 days"],
        ["last30", "Last 30 days"],
        ["thisMonth", "This month"],
        ["lastMonth", "Last month"],
        ["thisYear", "This year"],
      ],
    );
  });

  it("counts the last N days including today", () => {
    assert.deepEqual([byId("last7").from, byId("last7").to], ["2026-10-06", "2026-10-12"]);
    assert.deepEqual([byId("last30").from, byId("last30").to], ["2026-09-13", "2026-10-12"]);
  });

  it("this month runs from the 1st to today", () => {
    assert.deepEqual([byId("thisMonth").from, byId("thisMonth").to], ["2026-10-01", "2026-10-12"]);
  });

  it("last month is the whole previous month, across a year change too", () => {
    assert.deepEqual([byId("lastMonth").from, byId("lastMonth").to], ["2026-09-01", "2026-09-30"]);
    const jan = rangePresets("2026-01-15").find((p) => p.id === "lastMonth")!;
    assert.deepEqual([jan.from, jan.to], ["2025-12-01", "2025-12-31"]);
    const leap = rangePresets("2028-03-10").find((p) => p.id === "lastMonth")!;
    assert.deepEqual([leap.from, leap.to], ["2028-02-01", "2028-02-29"]);
  });

  it("this year runs from 1 January to today", () => {
    assert.deepEqual([byId("thisYear").from, byId("thisYear").to], ["2026-01-01", "2026-10-12"]);
  });
});

describe("activeRangePreset", () => {
  const today = "2026-10-12";

  it("finds the shortcut that matches the range exactly", () => {
    assert.equal(activeRangePreset("2026-10-06", "2026-10-12", today), "last7");
    assert.equal(activeRangePreset("2026-09-01", "2026-09-30", today), "lastMonth");
  });

  it("is null for any other range", () => {
    assert.equal(activeRangePreset("2026-10-07", "2026-10-12", today), null);
    assert.equal(activeRangePreset(null, null, today), null);
    assert.equal(activeRangePreset("2026-10-06", null, today), null);
  });
});

describe("rangeLabel", () => {
  it("says so when there is no range", () => {
    assert.equal(rangeLabel(null, null), "Any date");
  });

  it("shows a closed range", () => {
    assert.equal(rangeLabel("2026-10-01", "2026-10-12"), "1 Oct – 12 Oct 2026");
  });

  it("repeats the year only when the ends are in different years", () => {
    assert.equal(rangeLabel("2025-12-20", "2026-01-05"), "20 Dec 2025 – 5 Jan 2026");
  });

  it("shows one day once", () => {
    assert.equal(rangeLabel("2026-10-12", "2026-10-12"), "12 Oct 2026");
  });

  it("shows an open end", () => {
    assert.equal(rangeLabel("2026-10-01", null), "From 1 Oct 2026");
    assert.equal(rangeLabel(null, "2026-10-12"), "Until 12 Oct 2026");
  });
});
