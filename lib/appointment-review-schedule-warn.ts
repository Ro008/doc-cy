import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import type { DayKey, WeeklySchedule } from "@/lib/doctor-settings";

function toMinutesFromMidnight(time: string | null | undefined): number | null {
  if (!time) return null;
  const part = String(time).trim();
  const [hRaw, mRaw] = part.split(":");
  const h = Number.parseInt(hRaw ?? "", 10);
  const m = Number.parseInt(mRaw ?? "", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Cyprus calendar day key for this instant (Europe/Nicosia). */
function cyprusDayKey(utcIso: string): DayKey {
  const isoDow = Number(formatInTimeZone(new Date(utcIso), CY_TZ, "i"));
  const map: Record<number, DayKey> = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
    7: "sunday",
  };
  return map[isoDow] ?? "monday";
}

function cyprusStartMinutesFromMidnight(utcIso: string): number {
  const h = Number(formatInTimeZone(new Date(utcIso), CY_TZ, "H"));
  const min = Number(formatInTimeZone(new Date(utcIso), CY_TZ, "m"));
  return h * 60 + min;
}

export type ScheduleOverlapWarning = {
  /** HH:mm (24h) in Cyprus for the boundary (break start or end of working hours). */
  boundaryTimeLabel: string;
};

function formatMinutesAsHHmm(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * If the visit [start, start+duration) extends into the lunch break or past the
 * configured end of the working day (Cyprus wall time), returns a label for the
 * boundary time. Purely advisory — callers may still confirm.
 */
export function getScheduleOverlapWarning(
  appointmentDatetimeIso: string,
  durationMinutes: number,
  weeklySchedule: WeeklySchedule,
  breakStart: string | null,
  breakEnd: string | null
): ScheduleOverlapWarning | null {
  const dayKey = cyprusDayKey(appointmentDatetimeIso);
  const dayCfg = weeklySchedule[dayKey];
  const workEnd = toMinutesFromMidnight(dayCfg.end_time) ?? 17 * 60;
  const startMin = cyprusStartMinutesFromMidnight(appointmentDatetimeIso);
  const endMin = startMin + durationMinutes;

  const bs = toMinutesFromMidnight(breakStart);
  const be = toMinutesFromMidnight(breakEnd);
  const hasBreak = bs != null && be != null && be > bs;

  if (hasBreak) {
    const overlapsBreak = startMin < be && endMin > bs;
    if (overlapsBreak) {
      return { boundaryTimeLabel: formatMinutesAsHHmm(bs) };
    }
  }

  if (endMin > workEnd) {
    return { boundaryTimeLabel: formatMinutesAsHHmm(workEnd) };
  }

  return null;
}
