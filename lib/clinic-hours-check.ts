import { DAY_NAMES, type DayKey, type WeeklySchedule } from "@/lib/doctor-settings";

/**
 * A clinic's hours must make sense before they are saved (user, 2026-10-10): an open
 * day ends after it starts, and so does the break. Checked in the settings form (the
 * day's row says so and Save stays off) and again in POST /api/doctor-settings.
 */

export type ClinicHoursToCheck = {
  weeklySchedule?: Partial<WeeklySchedule> | null;
  breakEnabled?: boolean;
  breakStart?: string | null;
  breakEnd?: string | null;
};

export type ClinicHoursProblems = {
  /** Open days whose times are wrong, in week order. */
  days: Partial<Record<DayKey, string>>;
  breakTime: string | null;
};

/** "09:00:00" or "9:00" → "09:00"; null when it is not a time of day. */
function hhmm(value: unknown): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

const dayLabel = (day: DayKey) => `${day[0].toUpperCase()}${day.slice(1)}`;

export function clinicHoursProblems(hours: ClinicHoursToCheck): ClinicHoursProblems {
  const days: Partial<Record<DayKey, string>> = {};
  for (const day of DAY_NAMES) {
    const entry = hours.weeklySchedule?.[day];
    if (!entry?.enabled) continue;
    const start = hhmm(entry.start_time);
    const end = hhmm(entry.end_time);
    if (!start || !end) days[day] = `${dayLabel(day)} needs a start and an end time.`;
    else if (end <= start) days[day] = `${dayLabel(day)} must end after ${start}.`;
  }

  let breakTime: string | null = null;
  if (hours.breakEnabled) {
    const start = hhmm(hours.breakStart);
    const end = hhmm(hours.breakEnd);
    if (!start || !end) breakTime = "The break needs a start and an end time.";
    else if (end <= start) breakTime = `The break must end after ${start}.`;
  }
  return { days, breakTime };
}

/** Why these hours cannot be saved (the first reason), or null. */
export function clinicHoursProblem(hours: ClinicHoursToCheck): string | null {
  const problems = clinicHoursProblems(hours);
  return Object.values(problems.days)[0] ?? problems.breakTime;
}
