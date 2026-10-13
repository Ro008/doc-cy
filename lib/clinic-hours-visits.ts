import { formatInTimeZone } from "date-fns-tz";

import type { DayKey, WeeklySchedule } from "@/lib/doctor-settings";

/**
 * Settings → Clinics, stage 5 (user, 2026-10-11): before a save leaves confirmed visits
 * or open requests outside her hours, and before she pauses a clinic that has some, she
 * is told. Nothing is ever cancelled: the warnings only inform.
 */

const CYPRUS_TZ = "Europe/Nicosia";
const DAYS: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Why a visit does not fit a week: the day is closed, outside its hours, or in its break. */
export type HoursVisitReason = "closed" | "hours" | "break";

const hhmm = (time: string | null | undefined) => String(time ?? "").slice(0, 5);

/**
 * Whether a visit starting at this instant fits the week, by its start time (as the
 * booking calendar offers times). The week carries each day's own break.
 */
export function visitOutsideWeek(atIso: string, week: WeeklySchedule): HoursVisitReason | null {
  const at = new Date(atIso);
  const day = week[DAYS[Number(formatInTimeZone(at, CYPRUS_TZ, "i")) - 1]!];
  if (!day?.enabled) return "closed";
  const time = formatInTimeZone(at, CYPRUS_TZ, "HH:mm");
  if (time < hhmm(day.start_time) || time >= hhmm(day.end_time)) return "hours";
  const breakStart = hhmm(day.break_start);
  const breakEnd = hhmm(day.break_end);
  if (breakStart && breakEnd && time >= breakStart && time < breakEnd) return "break";
  return null;
}

/**
 * The visits a change of hours leaves outside: inside the week as saved, outside the new
 * one. A visit that was already outside (added by hand at an odd time) is not this
 * change's doing and is left out.
 */
export function visitsLeftOutside<T extends { at: string }>(
  visits: readonly T[],
  current: WeeklySchedule,
  next: WeeklySchedule,
): Array<T & { reason: HoursVisitReason }> {
  const left: Array<T & { reason: HoursVisitReason }> = [];
  for (const visit of visits) {
    if (visitOutsideWeek(visit.at, current) !== null) continue;
    const reason = visitOutsideWeek(visit.at, next);
    if (reason) left.push({ ...visit, reason });
  }
  return left;
}

export const HOURS_VISIT_REASON_LABEL: Record<HoursVisitReason, string> = {
  closed: "day closed",
  hours: "outside the hours",
  break: "in a break",
};

export type VisitCounts = { confirmed: number; open: number };

export function hoursVisitNotes(counts: VisitCounts): string[] {
  const notes: string[] = [];
  if (counts.confirmed === 1) {
    notes.push("1 confirmed visit falls outside these hours. It stays in your agenda: changing your hours cancels nothing.");
  }
  if (counts.confirmed > 1) {
    notes.push(
      `${counts.confirmed} confirmed visits fall outside these hours. They stay in your agenda: changing your hours cancels nothing.`,
    );
  }
  if (counts.open === 1) notes.push("1 request outside these hours is waiting for your answer.");
  if (counts.open > 1) notes.push(`${counts.open} requests outside these hours are waiting for your answer.`);
  return notes;
}

/** Before she switches a clinic's online booking off. */
export function pauseClinicNotes(counts: VisitCounts): string[] {
  const notes: string[] = [];
  if (counts.confirmed === 1) notes.push("1 confirmed visit at this clinic stays in your agenda.");
  if (counts.confirmed > 1) notes.push(`${counts.confirmed} confirmed visits at this clinic stay in your agenda.`);
  if (counts.open === 1) {
    notes.push("1 request at this clinic is waiting for your answer. You can still answer it.");
  }
  if (counts.open > 1) {
    notes.push(`${counts.open} requests at this clinic are waiting for your answer. You can still answer them.`);
  }
  return notes;
}

/** Under the switch of a clinic whose online booking is off because her access ended. */
export const ACCESS_ENDED_SWITCH_NOTE = "Opens again when your DocCy access is renewed.";

/** Beside the two buttons in a clinic's hours editor. */
export const APPLY_WEEK_NOTE = "Copies the open days, hours and breaks above to your other clinics.";
export const APPLY_SLOT_NOTE = "Copies this slot length to your other clinics.";
export const APPLY_LIMITS_NOTE =
  "“Apply to all my clinics” copies these three limits to your other clinics.";

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The confirmation of "Apply to all my clinics" for the week or the slot length. */
export function applyToAllCopy(
  kind: "week" | "slot",
  sourceName: string,
  otherNames: readonly string[],
  slotMinutes?: number,
): { title: string; description: string; confirm: string; done: string } {
  const total = otherNames.length + 1;
  const confirm = `Apply to all ${total} clinics`;
  if (kind === "week") {
    return {
      title: "Apply these hours to all your clinics?",
      description: `${listNames(otherNames)} will get the same open days, hours and breaks as ${sourceName}. Slot length, booking limits and the online booking switch stay as they are at each clinic.`,
      confirm,
      done: `Hours applied to all ${total} of your clinics.`,
    };
  }
  return {
    title: "Apply this slot length to all your clinics?",
    description: `${listNames(otherNames)} will use ${slotMinutes}-minute slots like ${sourceName}. Hours, booking limits and the online booking switch stay as they are at each clinic.`,
    confirm,
    done: `${slotMinutes}-minute slots applied to all ${total} of your clinics.`,
  };
}

/** On a request made at a clinic she has since left: accept or decline only. */
export const LEFT_CLINIC_PROPOSAL_MESSAGE =
  "You no longer work at this clinic, so you can accept or decline this request but not suggest other times.";
