import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format, startOfMonth, subMonths } from "date-fns";
import { buildLastSixMonthsAppointmentCounts } from "../../lib/founder-appointments-by-month";

function monthKey(monthsAgo: number): string {
  return format(startOfMonth(subMonths(new Date(), monthsAgo)), "yyyy-MM");
}

describe("buildLastSixMonthsAppointmentCounts", () => {
  it("zero-fills all 6 months when the RPC returns no rows", () => {
    const months = buildLastSixMonthsAppointmentCounts([]);
    assert.equal(months.length, 6);
    assert.deepEqual(
      months.map((m) => m.count),
      [0, 0, 0, 0, 0, 0],
    );
    assert.equal(months[5]?.key, monthKey(0));
  });

  it("maps each pre-aggregated month_key onto the matching bucket", () => {
    const months = buildLastSixMonthsAppointmentCounts([
      { month_key: monthKey(2), appt_count: 5 },
      { month_key: monthKey(0), appt_count: "12" },
    ]);
    const byKey = new Map(months.map((m) => [m.key, m.count]));
    assert.equal(byKey.get(monthKey(2)), 5);
    assert.equal(byKey.get(monthKey(0)), 12);
  });

  it("ignores a month_key outside the 6-month window", () => {
    const months = buildLastSixMonthsAppointmentCounts([
      { month_key: monthKey(11), appt_count: 99 },
    ]);
    assert.deepEqual(
      months.map((m) => m.count),
      [0, 0, 0, 0, 0, 0],
    );
  });

  it("treats a non-numeric appt_count as zero rather than NaN", () => {
    const months = buildLastSixMonthsAppointmentCounts([
      { month_key: monthKey(0), appt_count: null },
    ]);
    assert.equal(months[5]?.count, 0);
  });
});
