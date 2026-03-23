// lib/doctor-settings.ts
// Converts doctor_settings rows into the weekly slot shape used by BookingSection.
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
};

export type WeeklySchedule = Record<DayKey, DayScheduleEntry>;

export type DoctorSettingsRow = {
  doctor_id: string;
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
export const MIN_NOTICE_OPTIONS_HOURS = [1, 2, 12, 24] as const;
export const DEFAULT_BOOKING_HORIZON_DAYS = 90;
export const DEFAULT_MIN_NOTICE_HOURS = 2;

export type WeeklySlotFromSettings = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration: number;
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
    schedule[dayName] = {
      enabled:
        typeof dayRaw.enabled === "boolean" ? dayRaw.enabled : legacyEnabled,
      start_time: dayRaw.start_time ? toFullTime(dayRaw.start_time) : legacyStart,
      end_time: dayRaw.end_time ? toFullTime(dayRaw.end_time) : legacyEnd,
    };
  }
  return schedule;
}

/**
 * Build the weeklySlots array expected by BookingSection from a doctor_settings row.
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
      id: `settings-${settings.doctor_id}-${dayOfWeek}`,
      day_of_week: dayOfWeek,
      start_time: dayConfig.start_time,
      end_time: dayConfig.end_time,
      duration,
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
