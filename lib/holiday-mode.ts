import { addDays, format, parse } from "date-fns";
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";

import { formatDateDDMMYYYY } from "@/lib/date-format";

/**
 * Holiday mode (user, 2026-10-11): the professional's own dates, for every clinic
 * (professional_settings). No founder approves it and every change is recorded. It
 * cannot start in the past or end before it starts; one that is running may keep its
 * start and move its end. Once its end date has passed it counts as off, without any
 * job: the old dates are cleared on the next save. Saving warns about the visits in its
 * dates and never cancels one.
 */

const CYPRUS_TZ = "Europe/Nicosia";

/** As stored: dates are "YYYY-MM-DD", days in Cyprus. */
export type HolidayDates = { enabled: boolean; start: string | null; end: string | null };

export type HolidayState =
  | { kind: "off" }
  | { kind: "upcoming" | "active"; start: string; end: string };

export function cyprusTodayKey(now: Date = new Date()): string {
  return formatInTimeZone(now, CYPRUS_TZ, "yyyy-MM-dd");
}

/** What the stored holiday means today; a finished one is off. */
export function holidayState(holiday: HolidayDates, todayKey: string): HolidayState {
  if (!holiday.enabled || !holiday.start || !holiday.end) return { kind: "off" };
  if (holiday.end < todayKey) return { kind: "off" };
  return { kind: holiday.start > todayKey ? "upcoming" : "active", start: holiday.start, end: holiday.end };
}

/** The banner in Settings and in the agenda. */
export function holidayBannerText(state: HolidayState): string | null {
  if (state.kind === "off") return null;
  const start = formatDateDDMMYYYY(state.start);
  const end = formatDateDDMMYYYY(state.end);
  return state.kind === "active"
    ? `Holiday mode is on from ${start} until ${end}. Patients cannot book online for those days.`
    : `Holiday mode starts on ${start} and runs until ${end}. Patients cannot book online for those days.`;
}

/** Why these dates cannot be saved, or null. `saved` is the holiday as last saved. */
export function holidayDatesProblem(
  next: { start: string | null; end: string | null },
  saved: HolidayDates,
  todayKey: string,
): string | null {
  if (!next.start || !next.end) return "Pick both holiday dates.";
  if (next.start > next.end) return "The holiday must end on or after the day it starts.";
  if (next.end < todayKey) return "The holiday cannot end in the past.";
  const running = holidayState(saved, todayKey).kind === "active";
  if (next.start < todayKey && !(running && saved.start === next.start)) {
    return "The holiday cannot start in the past.";
  }
  return null;
}

export type HolidayVisitCounts = { confirmed: number; open: number };

/** What she is told before the dates are saved; nothing is cancelled. */
export function holidayVisitNotes(counts: HolidayVisitCounts): string[] {
  const notes: string[] = [];
  if (counts.confirmed === 1) {
    notes.push("1 confirmed visit falls in these dates. It stays in your agenda: holiday mode cancels nothing.");
  }
  if (counts.confirmed > 1) {
    notes.push(
      `${counts.confirmed} confirmed visits fall in these dates. They stay in your agenda: holiday mode cancels nothing.`,
    );
  }
  if (counts.open === 1) notes.push("1 request in these dates is waiting for your answer.");
  if (counts.open > 1) notes.push(`${counts.open} requests in these dates are waiting for your answer.`);
  return notes;
}

/** The holiday's days in Cyprus as instants: first midnight to the midnight after the last day. */
export function holidayRangeUtc(start: string, end: string): { from: string; to: string } {
  const dayAfter = format(addDays(parse(end, "yyyy-MM-dd", new Date()), 1), "yyyy-MM-dd");
  return {
    from: zonedTimeToUtc(`${start} 00:00:00`, CYPRUS_TZ).toISOString(),
    to: zonedTimeToUtc(`${dayAfter} 00:00:00`, CYPRUS_TZ).toISOString(),
  };
}
