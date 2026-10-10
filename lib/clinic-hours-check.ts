import { DAY_NAMES, type DayKey, type WeeklySchedule } from "@/lib/doctor-settings";

/**
 * A clinic's hours must make sense before they are saved (user, 2026-10-10): an open
 * day ends after it starts, and so does the break, and every time is on a quarter hour
 * (no 17:02). Checked in the settings form (times are picked by hour and quarter, the day's row
 * says what is wrong and Save stays off) and again in POST /api/doctor-settings.
 */

export const CLINIC_TIME_STEP_MINUTES = 15;

const QUARTER_HOUR = "on a quarter hour (:00, :15, :30 or :45).";

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

const onStep = (time: string) => Number(time.slice(3)) % CLINIC_TIME_STEP_MINUTES === 0;

/** The minutes the time picker offers, with any hour of the day. */
export const CLINIC_TIME_MINUTES = ["00", "15", "30", "45"] as const;

/** Whether the picker offers this time: any time, or only those after `after` (an end after its start). */
export function clinicTimeAllowed(time: string, after?: string | null): boolean {
  const from = hhmm(after);
  const value = hhmm(time);
  return Boolean(value) && (!from || value! > from);
}

/** Whether an hour ("09") still has a quarter on offer. */
export function clinicHourAllowed(hour: string, after?: string | null): boolean {
  return CLINIC_TIME_MINUTES.some((minute) => clinicTimeAllowed(`${hour}:${minute}`, after));
}

/** The time with another hour: the minutes stay when they are a quarter still on offer. */
export function clinicTimeWithHour(time: string, hour: string, after?: string | null): string {
  const minutes = (hhmm(time) ?? "09:00").slice(3);
  const choices = CLINIC_TIME_MINUTES.filter((minute) => clinicTimeAllowed(`${hour}:${minute}`, after));
  const minute = choices.find((choice) => choice === minutes) ?? choices[0] ?? "00";
  return `${hour}:${minute}`;
}

/** The time with other minutes. */
export function clinicTimeWithMinute(time: string, minute: string): string {
  return `${(hhmm(time) ?? "09:00").slice(0, 2)}:${minute}`;
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
    else if (!onStep(start) || !onStep(end)) days[day] = `${dayLabel(day)} must start and end ${QUARTER_HOUR}`;
    else if (end <= start) days[day] = `${dayLabel(day)} must end after ${start}.`;
  }

  let breakTime: string | null = null;
  if (hours.breakEnabled) {
    const start = hhmm(hours.breakStart);
    const end = hhmm(hours.breakEnd);
    if (!start || !end) breakTime = "The break needs a start and an end time.";
    else if (!onStep(start) || !onStep(end)) breakTime = `The break must start and end ${QUARTER_HOUR}`;
    else if (end <= start) breakTime = `The break must end after ${start}.`;
  }
  return { days, breakTime };
}

/** Why these hours cannot be saved (the first reason), or null. */
export function clinicHoursProblem(hours: ClinicHoursToCheck): string | null {
  const problems = clinicHoursProblems(hours);
  return Object.values(problems.days)[0] ?? problems.breakTime;
}
