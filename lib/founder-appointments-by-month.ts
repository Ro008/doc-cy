import { format, parseISO, startOfMonth, subMonths } from "date-fns";

export type MonthBucket = { key: string; label: string; count: number };

/** Last 6 calendar months including current; counts by appointment created_at (yyyy-MM in UTC). */
export function buildLastSixMonthsAppointmentCounts(
  rows: { created_at: string | null }[]
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
    if (!row.created_at) continue;
    try {
      const key = format(parseISO(row.created_at), "yyyy-MM");
      const i = idxByKey.get(key);
      if (i !== undefined) months[i].count += 1;
    } catch {
      /* invalid date */
    }
  }
  return months;
}
