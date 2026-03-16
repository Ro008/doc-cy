// lib/doctor-settings.ts
// Converts doctor_settings row into the weeklySlots shape used by BookingSection.
// day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

export type DoctorSettingsRow = {
  doctor_id: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  start_time: string; // "09:00:00" or "09:00"
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
};

export type WeeklySlotFromSettings = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration: number;
};

const DAY_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;
// JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
const DAY_OF_WEEK_MAP: Record<(typeof DAY_NAMES)[number], number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
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

/**
 * Build the weeklySlots array expected by BookingSection from a doctor_settings row.
 * Only includes days that are enabled (Mon–Fri).
 */
export function settingsToWeeklySlots(
  settings: DoctorSettingsRow
): WeeklySlotFromSettings[] {
  const startTime = toFullTime(settings.start_time);
  const endTime = toFullTime(settings.end_time);
  const duration = settings.slot_duration_minutes;

  const slots: WeeklySlotFromSettings[] = [];

  for (const dayName of DAY_NAMES) {
    const enabled = settings[dayName];
    if (!enabled) continue;
    const dayOfWeek = DAY_OF_WEEK_MAP[dayName];
    slots.push({
      id: `settings-${settings.doctor_id}-${dayOfWeek}`,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      duration,
    });
  }

  return slots;
}

const DAY_OF_WEEK_TO_KEY: Record<number, keyof DoctorSettingsRow> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
};

/** Check if a given day (0-6) and time string (HH:mm or HH:mm:00) is within settings. */
export function isTimeWithinSettings(
  settings: DoctorSettingsRow,
  dayOfWeek: number,
  hhmm: string
): boolean {
  const key = DAY_OF_WEEK_TO_KEY[dayOfWeek];
  const enabled = key ? Boolean(settings[key]) : false;
  if (!enabled) return false;
  const start = toFullTime(settings.start_time);
  const end = toFullTime(settings.end_time);
  const t = hhmm.length === 5 ? `${hhmm}:00` : hhmm;
  return t >= start && t < end;
}
