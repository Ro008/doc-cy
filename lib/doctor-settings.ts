// lib/doctor-settings.ts
// Converts a schedule (a clinic link's, merged with the account settings: see
// locationToSettingsRow) into the weekly slot shape used by BookingSection.
// day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DayScheduleEntry = {
  enabled: boolean;
  start_time: string; // "HH:mm:00"
  end_time: string; // "HH:mm:00"
  /**
   * The day's own break (user, 2026-10-10), "HH:mm:00", null for none. A schedule saved
   * before that has no break keys on its days: they follow the clinic's one break
   * (`break_start` / `break_end` on the clinic link). See `dayBreakTimes`.
   */
  break_start?: string | null;
  break_end?: string | null;
};

export type WeeklySchedule = Record<DayKey, DayScheduleEntry>;

/**
 * A bookable schedule: one clinic link's hours, break, slot length and pause merged with the
 * account settings (`locationToSettingsRow`). Not a table row: since Point E6
 * professional_settings holds only the account fields.
 */
export type DoctorSettingsRow = {
  professional_id: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  start_time: string; // legacy global range ("09:00:00" or "09:00")
  end_time: string;
  weekly_schedule?: Partial<Record<DayKey, Partial<DayScheduleEntry>>> | null;
  break_start: string | null;
  break_end: string | null;
  pause_online_bookings: boolean;
  holiday_mode_enabled: boolean;
  holiday_start_date: string | null; // "YYYY-MM-DD"
  holiday_end_date: string | null; // "YYYY-MM-DD"
  booking_horizon_days: number;
  minimum_notice_hours: number;
  slot_duration_minutes: number;
};

export const BOOKING_HORIZON_OPTIONS_DAYS = [14, 30, 90, 180] as const;
/** Allowed minimum-notice values (hours). Keep in sync with DB CHECK constraint. */
export const MIN_NOTICE_OPTIONS_HOURS = [1, 2, 4, 12, 24, 48, 72, 168] as const;
export type MinNoticeHours = (typeof MIN_NOTICE_OPTIONS_HOURS)[number];
export const DEFAULT_BOOKING_HORIZON_DAYS = 90;
export const DEFAULT_MIN_NOTICE_HOURS = 2;

export function isMinNoticeHours(value: number): value is MinNoticeHours {
  return (MIN_NOTICE_OPTIONS_HOURS as readonly number[]).includes(value);
}

export function normalizeMinimumNoticeHours(value: number | null | undefined): number {
  const n = Number(value);
  return isMinNoticeHours(n) ? n : DEFAULT_MIN_NOTICE_HOURS;
}

export type WeeklySlotFromSettings = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration: number;
  /** That day's break ("HH:mm:00"), null for none. */
  break_start?: string | null;
  break_end?: string | null;
};

export const DAY_NAMES: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
// JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
const DAY_OF_WEEK_MAP: Record<DayKey, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

/** Normalize time string to HH:mm (no seconds) for consistency */
function normalizeTime(t: string): string {
  const parts = t.split(":");
  const h = parts[0]?.padStart(2, "0") ?? "09";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}`;
}

/** Convert Supabase time to HH:mm:00 for slots API compatibility if needed */
export function toFullTime(t: string): string {
  const n = normalizeTime(t);
  return n.includes(":") && n.split(":").length === 2 ? `${n}:00` : `${n}:00`;
}

/** Whether a day carries its own break (even "none"), instead of following the clinic's one break. */
export function dayHasOwnBreak(day: Partial<DayScheduleEntry> | null | undefined): boolean {
  return Boolean(day) && Object.prototype.hasOwnProperty.call(day, "break_start");
}

/**
 * One day's break as "HH:mm", or null: the day's own when it has break keys, else the
 * clinic's one break (schedules saved before breaks were per day).
 */
export function dayBreakTimes(
  day: Partial<DayScheduleEntry> | null | undefined,
  clinicBreakStart?: string | null,
  clinicBreakEnd?: string | null,
): { start: string; end: string } | null {
  const own = dayHasOwnBreak(day);
  const start = own ? day?.break_start : clinicBreakStart;
  const end = own ? day?.break_end : clinicBreakEnd;
  if (!start || !end) return null;
  return { start: normalizeTime(String(start)), end: normalizeTime(String(end)) };
}

/** Every day with its hours and its effective break (its own, or the clinic's one break). */
export function buildWeeklyScheduleFromSettings(
  settings: DoctorSettingsRow
): WeeklySchedule {
  const legacyStart = toFullTime(settings.start_time ?? "09:00");
  const legacyEnd = toFullTime(settings.end_time ?? "17:00");
  const raw = settings.weekly_schedule ?? {};

  const schedule = {} as WeeklySchedule;
  for (const dayName of DAY_NAMES) {
    const legacyEnabled = Boolean((settings as Record<string, unknown>)[dayName]);
    const dayRaw = (raw as Record<string, Partial<DayScheduleEntry>>)[dayName] ?? {};
    const dayBreak = dayBreakTimes(dayRaw, settings.break_start, settings.break_end);
    schedule[dayName] = {
      enabled:
        typeof dayRaw.enabled === "boolean" ? dayRaw.enabled : legacyEnabled,
      start_time: dayRaw.start_time ? toFullTime(dayRaw.start_time) : legacyStart,
      end_time: dayRaw.end_time ? toFullTime(dayRaw.end_time) : legacyEnd,
      break_start: dayBreak ? `${dayBreak.start}:00` : null,
      break_end: dayBreak ? `${dayBreak.end}:00` : null,
    };
  }
  return schedule;
}

/**
 * Build the weeklySlots array expected by BookingSection from a clinic's merged settings row.
 * Only includes days that are enabled (Mon–Sun).
 */
export function settingsToWeeklySlots(
  settings: DoctorSettingsRow
): WeeklySlotFromSettings[] {
  const duration = settings.slot_duration_minutes;
  const weeklySchedule = buildWeeklyScheduleFromSettings(settings);

  const slots: WeeklySlotFromSettings[] = [];

  for (const dayName of DAY_NAMES) {
    const dayConfig = weeklySchedule[dayName];
    if (!dayConfig.enabled) continue;
    const dayOfWeek = DAY_OF_WEEK_MAP[dayName];
    slots.push({
      id: `settings-${settings.professional_id}-${dayOfWeek}`,
      day_of_week: dayOfWeek,
      start_time: dayConfig.start_time,
      end_time: dayConfig.end_time,
      duration,
      break_start: dayConfig.break_start ?? null,
      break_end: dayConfig.break_end ?? null,
    });
  }

  return slots;
}

const DAY_OF_WEEK_TO_KEY: Record<number, DayKey> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  0: "sunday",
};

/** Check if a given day (0-6) and time string (HH:mm or HH:mm:00) is within settings. */
export function isTimeWithinSettings(
  settings: DoctorSettingsRow,
  dayOfWeek: number,
  hhmm: string
): boolean {
  const key = DAY_OF_WEEK_TO_KEY[dayOfWeek];
  if (!key) return false;
  const dayConfig = buildWeeklyScheduleFromSettings(settings)[key];
  if (!dayConfig.enabled) return false;
  const start = dayConfig.start_time;
  const end = dayConfig.end_time;
  const t = hhmm.length === 5 ? `${hhmm}:00` : hhmm;
  return t >= start && t < end;
}

export function isDateInHolidayRange(
  settings: DoctorSettingsRow,
  cyprusDateKey: string // YYYY-MM-DD in Europe/Nicosia
): boolean {
  if (!settings.holiday_mode_enabled) return false;
  const start = settings.holiday_start_date;
  const end = settings.holiday_end_date;
  if (!start || !end) return false;
  return cyprusDateKey >= start && cyprusDateKey <= end;
}
