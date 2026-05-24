import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import {
  type DayKey,
  type WeeklySchedule,
  DAY_NAMES,
} from "@/lib/doctor-settings";

/** Average minutes of phone tag per booking moved to DocCy (reception estimate). */
export const PHONE_MINUTES_PER_CONFIRMED_BOOKING = 4;

export type InsightsAppointmentRow = {
  appointment_datetime: string;
  status: string;
  created_at: string | null;
};

export type WeekdayBucketKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type PracticeInsightsSnapshot = {
  monthLabel: string;
  phoneTimeSavedHours: number;
  confirmedThisMonth: number;
  totalBookingsThisMonth: number;
  weekendShieldCount: number;
  peakByWeekday: { day: WeekdayBucketKey; count: number }[];
  peakByHour: { hour: number; label: string; count: number }[];
};

/** ISO weekday from format `i` in Europe/Nicosia (1 = Monday … 7 = Sunday). */
const ISO_DAY_TO_KEY: Record<number, WeekdayBucketKey> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  7: "sunday",
};

function cyprusIsoWeekday(utcIso: string): number {
  return Number(formatInTimeZone(new Date(utcIso), CY_TZ, "i"));
}

function normalizeStatus(status: string): string {
  return String(status ?? "").trim().toUpperCase();
}

function isActiveBookingStatus(status: string): boolean {
  const s = normalizeStatus(status);
  return s === "CONFIRMED" || s === "REQUESTED" || s === "NEEDS_RESCHEDULE";
}

function isConfirmedStatus(status: string): boolean {
  return normalizeStatus(status) === "CONFIRMED";
}

function parseTimeToMinutes(time: string): number {
  const parts = String(time ?? "").split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

/** True when the slot falls outside the doctor's published weekly hours. */
export function isOutsidePracticeHours(
  utcIso: string,
  weeklySchedule: WeeklySchedule | null,
): boolean {
  if (!weeklySchedule) {
    const hour = Number(formatInTimeZone(new Date(utcIso), CY_TZ, "H"));
    const isoDay = cyprusIsoWeekday(utcIso);
    if (isoDay === 6 || isoDay === 7) return true;
    return hour < 8 || hour >= 18;
  }

  const dayKey = ISO_DAY_TO_KEY[cyprusIsoWeekday(utcIso)];
  if (!dayKey) return true;

  const entry = weeklySchedule[dayKey];
  if (!entry?.enabled) return true;

  const hour = Number(formatInTimeZone(new Date(utcIso), CY_TZ, "H"));
  const minute = Number(formatInTimeZone(new Date(utcIso), CY_TZ, "m"));
  const slotMinutes = hour * 60 + minute;
  const start = parseTimeToMinutes(entry.start_time);
  const end = parseTimeToMinutes(entry.end_time);
  return slotMinutes < start || slotMinutes >= end;
}

function cyprusMonthRange(now = new Date()): { startUtc: Date; endUtc: Date; label: string } {
  const monthKey = formatInTimeZone(now, CY_TZ, "yyyy-MM");
  const startUtc = zonedTimeToUtc(`${monthKey}-01T00:00:00`, CY_TZ);
  const nextMonth = addMonths(startOfMonth(parseISO(`${monthKey}-01`)), 1);
  const nextKey = format(nextMonth, "yyyy-MM");
  const endUtc = zonedTimeToUtc(`${nextKey}-01T00:00:00`, CY_TZ);
  const label = formatInTimeZone(now, CY_TZ, "MMMM yyyy");
  return { startUtc, endUtc, label };
}

function isInCyprusMonth(iso: string, startUtc: Date, endUtc: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= startUtc.getTime() && t < endUtc.getTime();
}

export function buildPracticeInsights(
  rows: InsightsAppointmentRow[],
  weeklySchedule: WeeklySchedule | null,
  now = new Date(),
): PracticeInsightsSnapshot {
  const { startUtc, endUtc, label } = cyprusMonthRange(now);

  let confirmedThisMonth = 0;
  let totalBookingsThisMonth = 0;
  let weekendShieldCount = 0;

  const weekdayCounts = Object.fromEntries(
    DAY_NAMES.map((d) => [d, 0]),
  ) as Record<WeekdayBucketKey, number>;
  const hourCounts = new Map<number, number>();

  for (const row of rows) {
    const status = normalizeStatus(row.status);
    if (status === "CANCELLED") continue;

    const createdAt = row.created_at ?? row.appointment_datetime;
    const inMonth = isInCyprusMonth(createdAt, startUtc, endUtc);

    if (inMonth && isActiveBookingStatus(status)) {
      totalBookingsThisMonth += 1;
    }
    if (inMonth && isConfirmedStatus(status)) {
      confirmedThisMonth += 1;
    }

    if (!isConfirmedStatus(status)) continue;

    if (isOutsidePracticeHours(row.appointment_datetime, weeklySchedule)) {
      weekendShieldCount += 1;
    }

    const dayKey = ISO_DAY_TO_KEY[cyprusIsoWeekday(row.appointment_datetime)];
    if (dayKey) weekdayCounts[dayKey] += 1;

    const hour = Number(formatInTimeZone(new Date(row.appointment_datetime), CY_TZ, "H"));
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  const phoneMinutes = confirmedThisMonth * PHONE_MINUTES_PER_CONFIRMED_BOOKING;
  const phoneTimeSavedHours = Math.round((phoneMinutes / 60) * 10) / 10;

  const peakByWeekday = DAY_NAMES.map((day) => ({
    day,
    count: weekdayCounts[day],
  }));

  const peakByHour = Array.from(hourCounts.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, count]) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      count,
    }));

  return {
    monthLabel: label,
    phoneTimeSavedHours,
    confirmedThisMonth,
    totalBookingsThisMonth,
    weekendShieldCount,
    peakByWeekday,
    peakByHour,
  };
}
