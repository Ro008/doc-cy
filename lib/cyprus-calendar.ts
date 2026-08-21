import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";

/**
 * First instant of the current calendar month in Cyprus (Europe/Nicosia), as UTC ISO string.
 * Use for Supabase `.gte('created_at', ...)` so "this month" matches Cyprus, not the server's TZ.
 *
 * (Using `startOfMonth(new Date()).toISOString()` on Vercel = UTC month boundary — can miscount.)
 */
export function cyprusMonthStartUtcIso(ref: Date = new Date()): string {
  const ym = formatInTimeZone(ref, CY_TZ, "yyyy-MM");
  const startUtc = zonedTimeToUtc(`${ym}-01 00:00:00`, CY_TZ);
  return startUtc.toISOString();
}

/**
 * Inclusive start / exclusive end of a Cyprus calendar month, as UTC ISO strings.
 * `offsetMonths` 0 = current month, -1 = previous month.
 */
export function cyprusCalendarMonthRangeUtc(
  offsetMonths: number,
  ref: Date = new Date(),
): { startIso: string; endIso: string; label: string } {
  const currentYm = formatInTimeZone(ref, CY_TZ, "yyyy-MM");
  const year = Number(currentYm.slice(0, 4));
  const month = Number(currentYm.slice(5, 7));
  const idx = year * 12 + (month - 1) + offsetMonths;
  const startYear = Math.floor(idx / 12);
  const startMonth = (idx % 12) + 1;
  const endIdx = idx + 1;
  const endYear = Math.floor(endIdx / 12);
  const endMonth = (endIdx % 12) + 1;
  const startYm = `${startYear}-${String(startMonth).padStart(2, "0")}`;
  const endYm = `${endYear}-${String(endMonth).padStart(2, "0")}`;
  const start = zonedTimeToUtc(`${startYm}-01 00:00:00`, CY_TZ);
  const end = zonedTimeToUtc(`${endYm}-01 00:00:00`, CY_TZ);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: formatInTimeZone(start, CY_TZ, "MMMM yyyy"),
  };
}
