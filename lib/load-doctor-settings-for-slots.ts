import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildWeeklyScheduleFromSettings,
  settingsToWeeklySlots,
  type DoctorSettingsRow,
  type WeeklySlotFromSettings,
} from "@/lib/doctor-settings";

const SETTINGS_SELECT_FULL =
  "doctor_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule, break_start, break_end, pause_online_bookings, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours, slot_duration_minutes";

const SETTINGS_SELECT_FALLBACK =
  "doctor_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, break_start, break_end, pause_online_bookings, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours, slot_duration_minutes";

export type DoctorSettingsForSlots = {
  settings: DoctorSettingsRow;
  weeklySlots: WeeklySlotFromSettings[];
  fallbackSlotDurationMinutes: number;
};

export async function loadDoctorSettingsForSlots(
  supabase: SupabaseClient,
  doctorId: string
): Promise<DoctorSettingsForSlots | null> {
  let res = await supabase
    .from("doctor_settings")
    .select(SETTINGS_SELECT_FULL)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  const weeklyMissing =
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("weekly_schedule") ||
      (res.error as { code?: string }).code === "42703");

  if (weeklyMissing) {
    res = await supabase
      .from("doctor_settings")
      .select(SETTINGS_SELECT_FALLBACK)
      .eq("doctor_id", doctorId)
      .maybeSingle();
  }

  if (res.error || !res.data) {
    return null;
  }

  const raw = res.data as DoctorSettingsRow;
  const settings: DoctorSettingsRow = {
    ...raw,
    weekly_schedule: raw.weekly_schedule ?? null,
  };
  buildWeeklyScheduleFromSettings(settings);
  const weeklySlots = settingsToWeeklySlots(settings);
  const fallbackSlotDurationMinutes =
    Number(settings.slot_duration_minutes) > 0
      ? Number(settings.slot_duration_minutes)
      : 30;

  return { settings, weeklySlots, fallbackSlotDurationMinutes };
}
