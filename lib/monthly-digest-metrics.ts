import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import {
  isOutsidePracticeHours,
  PHONE_MINUTES_PER_CONFIRMED_BOOKING,
  type InsightsAppointmentRow,
} from "@/lib/practice-insights";
import type { WeeklySchedule } from "@/lib/doctor-settings";

export type MonthlyDigestMetrics = {
  monthKey: string;
  monthLabel: string;
  phoneTimeSavedHours: number;
  closedHoursAppointmentsCount: number;
  confirmedThisMonth: number;
};

function normalizeStatus(status: string): string {
  return String(status ?? "").trim().toUpperCase();
}

function isConfirmedStatus(status: string): boolean {
  return normalizeStatus(status) === "CONFIRMED";
}

function cyprusMonthRange(now = new Date()): { startUtc: Date; endUtc: Date; label: string; monthKey: string } {
  const monthKey = formatInTimeZone(now, CY_TZ, "yyyy-MM");
  const startUtc = zonedTimeToUtc(`${monthKey}-01T00:00:00`, CY_TZ);
  const nextMonth = addMonths(startOfMonth(parseISO(`${monthKey}-01`)), 1);
  const nextKey = format(nextMonth, "yyyy-MM");
  const endUtc = zonedTimeToUtc(`${nextKey}-01T00:00:00`, CY_TZ);
  const label = formatInTimeZone(now, CY_TZ, "MMMM yyyy");
  return { startUtc, endUtc, label, monthKey };
}

function isInCyprusMonth(iso: string, startUtc: Date, endUtc: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= startUtc.getTime() && t < endUtc.getTime();
}

/** yyyy-MM for the calendar month before `now` in Cyprus time. */
export function cyprusPreviousMonthKey(now = new Date()): string {
  const currentKey = formatInTimeZone(now, CY_TZ, "yyyy-MM");
  const [year, month] = currentKey.split("-").map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

/** Any instant inside the given yyyy-MM month (Cyprus). */
export function cyprusMonthReferenceFromKey(monthKey: string): Date {
  return zonedTimeToUtc(`${monthKey}-15T12:00:00`, CY_TZ);
}

export function buildMonthlyDigestMetrics(
  rows: InsightsAppointmentRow[],
  weeklySchedule: WeeklySchedule | null,
  reportMonth: Date,
): MonthlyDigestMetrics {
  const { startUtc, endUtc, label, monthKey } = cyprusMonthRange(reportMonth);

  let confirmedThisMonth = 0;
  let closedHoursAppointmentsCount = 0;

  for (const row of rows) {
    const status = normalizeStatus(row.status);
    if (!isConfirmedStatus(status)) continue;

    const createdAt = row.created_at ?? row.appointment_datetime;
    if (!isInCyprusMonth(createdAt, startUtc, endUtc)) continue;

    confirmedThisMonth += 1;
    if (isOutsidePracticeHours(row.appointment_datetime, weeklySchedule)) {
      closedHoursAppointmentsCount += 1;
    }
  }

  const phoneMinutes = confirmedThisMonth * PHONE_MINUTES_PER_CONFIRMED_BOOKING;
  const phoneTimeSavedHours = Math.round((phoneMinutes / 60) * 10) / 10;

  return {
    monthKey,
    monthLabel: label,
    phoneTimeSavedHours,
    closedHoursAppointmentsCount,
    confirmedThisMonth,
  };
}

export function monthlyDigestHasActivity(metrics: MonthlyDigestMetrics): boolean {
  return metrics.confirmedThisMonth > 0;
}
