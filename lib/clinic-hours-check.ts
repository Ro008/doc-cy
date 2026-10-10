import { DAY_NAMES, dayHasOwnBreak, type DayKey, type WeeklySchedule } from "@/lib/doctor-settings";

/**
 * A clinic's hours must make sense before they are saved (user, 2026-10-10): an open
 * day ends after it starts, and so does the break, and every time is on a quarter hour
 * (no 17:02). Checked in the settings form (times are picked by hour and quarter, the day's row
 * says what is wrong and Save stays off) and again in POST /api/doctor-settings.
 *
 * A day's own break (`break_start` / `break_end` on the day) follows the same rules
 * and sits inside that day's hours, not on their edge: a break at the start or the end
 * of the day is just shorter hours.
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

/**
 * Whether the picker offers this time: any time, or only those after `after` (an end
 * after its start) and before `before` (a break before the day ends).
 */
export function clinicTimeAllowed(time: string, after?: string | null, before?: string | null): boolean {
  const from = hhmm(after);
  const until = hhmm(before);
  const value = hhmm(time);
  return Boolean(value) && (!from || value! > from) && (!until || value! < until);
}

/** Whether an hour ("09") still has a quarter on offer. */
export function clinicHourAllowed(hour: string, after?: string | null, before?: string | null): boolean {
  return CLINIC_TIME_MINUTES.some((minute) => clinicTimeAllowed(`${hour}:${minute}`, after, before));
}

/** The time with another hour: the minutes stay when they are a quarter still on offer. */
export function clinicTimeWithHour(
  time: string,
  hour: string,
  after?: string | null,
  before?: string | null,
): string {
  const minutes = (hhmm(time) ?? "09:00").slice(3);
  const choices = CLINIC_TIME_MINUTES.filter((minute) => clinicTimeAllowed(`${hour}:${minute}`, after, before));
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
    if (days[day] || !dayHasOwnBreak(entry) || (entry.break_start == null && entry.break_end == null)) continue;

    const breakStart = hhmm(entry.break_start);
    const breakEnd = hhmm(entry.break_end);
    const its = `${dayLabel(day)}'s break`;
    if (!breakStart || !breakEnd) days[day] = `${its} needs a start and an end time.`;
    else if (!onStep(breakStart) || !onStep(breakEnd)) days[day] = `${its} must start and end ${QUARTER_HOUR}`;
    else if (breakEnd <= breakStart) days[day] = `${its} must end after ${breakStart}.`;
    else if (breakStart <= start! || breakEnd >= end!) {
      days[day] = `${its} must be within its hours (${start} – ${end}).`;
    }
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

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * The break "Add a break" starts from: 13:00 – 14:00 when it fits inside the day, else
 * half an hour in the middle, else a quarter after the start; null when the day is too
 * short to hold a break.
 */
export function defaultDayBreak(dayStart: string, dayEnd: string): { start: string; end: string } | null {
  const start = hhmm(dayStart);
  const end = hhmm(dayEnd);
  if (!start || !end || end <= start) return null;
  const from = toMinutes(start);
  const to = toMinutes(end);
  const step = CLINIC_TIME_STEP_MINUTES;
  const middle = Math.floor((from + to) / 2 / step) * step;
  const candidates = [
    [13 * 60, 14 * 60],
    [middle - step, middle + step],
    [Math.ceil((from + 1) / step) * step, Math.ceil((from + 1) / step) * step + step],
  ];
  const fits = candidates.find(([breakStart, breakEnd]) => breakStart > from && breakEnd < to);
  return fits ? { start: fromMinutes(fits[0]), end: fromMinutes(fits[1]) } : null;
}

/** Why these hours cannot be saved (the first reason), or null. */
export function clinicHoursProblem(hours: ClinicHoursToCheck): string | null {
  const problems = clinicHoursProblems(hours);
  return Object.values(problems.days)[0] ?? problems.breakTime;
}
