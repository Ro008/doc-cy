import { format, startOfMonth, subMonths } from "date-fns";

export type MonthBucket = { key: string; label: string; count: number };

/** One row from the `founder_appointments_by_month` SQL aggregate. */
export type AppointmentMonthCount = { month_key: string; appt_count: number | string | null };

/**
 * Last 6 calendar months including current, zero-filled. `rows` are
 * pre-aggregated by the database (one row per month with appointments) —
 * this only maps them onto a fixed 6-month scaffold for the chart.
 */
export function buildLastSixMonthsAppointmentCounts(
  rows: readonly AppointmentMonthCount[]
): MonthBucket[] {
  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = startOfMonth(subMonths(now, i));
    months.push({
      key: format(d, "yyyy-MM"),
      label: format(d, "MMM"),
      count: 0,
    });
  }
  const idxByKey = new Map(months.map((m, i) => [m.key, i] as const));
  for (const row of rows) {
    const key = String(row.month_key ?? "");
    const i = idxByKey.get(key);
    if (i === undefined) continue;
    const count = Number(row.appt_count);
    months[i].count = Number.isFinite(count) ? count : 0;
  }
  return months;
}
