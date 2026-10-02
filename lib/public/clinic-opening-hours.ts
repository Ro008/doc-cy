import { DAY_NAMES, type DayKey, type WeeklySchedule } from "@/lib/doctor-settings";

/**
 * A clinic's opening hours for the public profile, from the same schedule that
 * produces its bookable times: days with identical hours grouped together, each
 * day's hours split around the break ("Mon–Fri 09:00–13:00, 14:00–17:00").
 */

export type OpeningRange = { open: string; close: string };
export type OpeningHoursGroup = { days: DayKey[]; ranges: OpeningRange[] };

/** Monday first, the way people read a week. */
const WEEK: DayKey[] = [...DAY_NAMES.filter((d) => d !== "sunday"), "sunday"];

const hhmm = (time: string | null | undefined): string => String(time ?? "").slice(0, 5);

function dayRanges(start: string, end: string, breakStart: string, breakEnd: string): OpeningRange[] {
  if (breakStart && breakEnd && breakStart > start && breakEnd < end && breakStart < breakEnd) {
    return [
      { open: start, close: breakStart },
      { open: breakEnd, close: end },
    ];
  }
  return [{ open: start, close: end }];
}

export function clinicOpeningHours(
  schedule: WeeklySchedule,
  options: { breakStart?: string | null; breakEnd?: string | null },
): OpeningHoursGroup[] {
  const breakStart = hhmm(options.breakStart);
  const breakEnd = hhmm(options.breakEnd);
  const groups: OpeningHoursGroup[] = [];
  for (const day of WEEK) {
    const entry = schedule[day];
    if (!entry?.enabled) continue;
    const start = hhmm(entry.start_time);
    const end = hhmm(entry.end_time);
    if (!start || !end || start >= end) continue;
    const ranges = dayRanges(start, end, breakStart, breakEnd);
    const key = JSON.stringify(ranges);
    const same = groups.find((group) => JSON.stringify(group.ranges) === key);
    if (same) same.days.push(day);
    else groups.push({ days: [day], ranges });
  }
  return groups;
}

/** "Mon–Fri", "Mon–Wed, Fri", "Mon, Tue": runs of three or more days become a range. */
export function formatOpeningDays(days: readonly DayKey[], label: (day: DayKey) => string): string {
  const order = days.map((day) => WEEK.indexOf(day)).sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1] === order[j] + 1) j += 1;
    const run = order.slice(i, j + 1).map((index) => label(WEEK[index]));
    parts.push(run.length >= 3 ? `${run[0]}–${run[run.length - 1]}` : run.join(", "));
    i = j + 1;
  }
  return parts.join(", ");
}

export function formatOpeningRanges(ranges: readonly OpeningRange[]): string {
  return ranges.map((range) => `${range.open}–${range.close}`).join(", ");
}
