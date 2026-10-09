import { DAY_NAMES, type DayKey, type WeeklySchedule } from "@/lib/doctor-settings";

/** The one-line summaries on a clinic's card in settings (design B1). */

const SHORT_DAY: Record<DayKey, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function hhmm(time: string): string {
  return String(time ?? "").slice(0, 5);
}

/** "Mon – Fri", "Mon, Wed, Fri", "Mon – Wed, Sat"; three or more days in a row become a range. */
export function summarizeClinicDays(schedule: WeeklySchedule): string {
  const runs: DayKey[][] = [];
  let run: DayKey[] = [];
  for (const day of DAY_NAMES) {
    if (schedule[day]?.enabled) {
      run.push(day);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  if (!runs.length) return "Closed";
  return runs
    .map((days) =>
      days.length >= 3
        ? `${SHORT_DAY[days[0]]} – ${SHORT_DAY[days[days.length - 1]]}`
        : days.map((day) => SHORT_DAY[day]).join(", "),
    )
    .join(", ");
}

export function summarizeClinicHours(schedule: WeeklySchedule): string {
  const open = DAY_NAMES.map((day) => schedule[day]).filter((entry) => entry?.enabled);
  if (!open.length) return "—";
  const ranges = new Set(open.map((entry) => `${hhmm(entry.start_time)} – ${hhmm(entry.end_time)}`));
  return ranges.size === 1 ? [...ranges][0] : "Varies by day";
}

export function summarizeClinicBreak(input: {
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
}): string {
  return input.breakEnabled ? `${hhmm(input.breakStart)} – ${hhmm(input.breakEnd)}` : "None";
}

export type ClinicBookingStatus =
  | { kind: "ended"; label: "Online booking off" }
  | { kind: "taking"; label: "Taking online bookings" }
  | { kind: "paused"; label: "Online booking paused" }
  | { kind: "holiday"; label: "Paused for your holiday" };

export function clinicBookingStatus(input: {
  pauseOnlineBookings: boolean;
  holidayActive: boolean;
  /** Pro access has ended: no clinic takes online bookings (lib/load-access-ended). */
  accessEnded?: boolean;
}): ClinicBookingStatus {
  if (input.accessEnded) return { kind: "ended", label: "Online booking off" };
  if (input.holidayActive) return { kind: "holiday", label: "Paused for your holiday" };
  if (input.pauseOnlineBookings) return { kind: "paused", label: "Online booking paused" };
  return { kind: "taking", label: "Taking online bookings" };
}
