import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";

/** Calendar day in Europe/Nicosia as `yyyy-MM-dd`. */
export function cyprusDateKey(ref: Date = new Date()): string {
  return formatInTimeZone(ref, CY_TZ, "yyyy-MM-dd");
}

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
