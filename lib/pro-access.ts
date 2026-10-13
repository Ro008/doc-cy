import { addMonths } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";

/**
 * `professionals.pro_access_until`: the paid-tier entitlement (online bookings today).
 * Access lasts until that moment (inclusive), so nothing has to switch it off when a
 * trial or subscription ends. Approving a registration sets it to the approval time
 * plus the trial months; a payment will push it forward.
 *
 * The trial length lives in `app_settings.trial_months`, which founders change in the
 * internal dashboard (see lib/trial-months-setting.ts).
 */

/** The free trial the sign-up page promises ("6 months free"). */
export const DEFAULT_TRIAL_MONTHS = 6;

/** Same bound as the database check on `app_settings`. */
export const MAX_TRIAL_MONTHS = 24;

/**
 * `months` calendar months later on the Cyprus calendar, at the same local time of
 * day (so DST in between doesn't move it by an hour). Ends of months clamp: 31 January
 * + 1 month is 28 February. Matches the database's
 * `((t at time zone 'Asia/Nicosia') + make_interval(months => n)) at time zone 'Asia/Nicosia'`.
 */
export function addCyprusMonths(from: Date, months: number): Date {
  return zonedTimeToUtc(addMonths(utcToZonedTime(from, CY_TZ), months), CY_TZ);
}

/** When a professional approved at `approvedAt` loses pro access; null = no trial. */
export function proAccessUntilForApproval(approvedAt: Date, trialMonths: number): Date | null {
  if (!(trialMonths > 0)) return null;
  return addCyprusMonths(approvedAt, trialMonths);
}

export function hasProAccess(
  proAccessUntil: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!proAccessUntil) return false;
  const until = proAccessUntil instanceof Date ? proAccessUntil : new Date(proAccessUntil);
  const time = until.getTime();
  // Access lasts while now <= pro_access_until (user, 2026-10-02).
  return Number.isFinite(time) && time >= now.getTime();
}

/** A whole number of months from 0 to MAX_TRIAL_MONTHS, or null. */
export function parseTrialMonths(value: unknown): number | null {
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && /^\d+$/.test(value.trim())) n = Number(value.trim());
  else return null;
  if (!Number.isInteger(n) || n < 0 || n > MAX_TRIAL_MONTHS) return null;
  return n;
}
