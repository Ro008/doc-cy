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

function isWeeklyScheduleColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    String(error.message ?? "").toLowerCase().includes("weekly_schedule") ||
    error.code === "42703"
  );
}

function toDoctorSettingsForSlots(raw: DoctorSettingsRow): DoctorSettingsForSlots {
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

export async function loadDoctorSettingsForSlots(
  supabase: SupabaseClient,
  doctorId: string
): Promise<DoctorSettingsForSlots | null> {
  let res = await supabase
    .from("doctor_settings")
    .select(SETTINGS_SELECT_FULL)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  if (isWeeklyScheduleColumnError(res.error)) {
    res = await supabase
      .from("doctor_settings")
      .select(SETTINGS_SELECT_FALLBACK)
      .eq("doctor_id", doctorId)
      .maybeSingle();
  }

  if (res.error || !res.data) {
    return null;
  }

  return toDoctorSettingsForSlots(res.data as DoctorSettingsRow);
}

/** One PostgREST round-trip for finder cards instead of N settings lookups. */
export async function loadDoctorSettingsForSlotsByDoctorIds(
  supabase: SupabaseClient,
  doctorIds: readonly string[],
): Promise<Map<string, DoctorSettingsForSlots>> {
  const uniqueIds = Array.from(new Set(doctorIds.filter(Boolean)));
  const byId = new Map<string, DoctorSettingsForSlots>();
  if (uniqueIds.length === 0) return byId;

  let rows: unknown[] | null = null;
  let error: { code?: string; message?: string } | null = null;

  const fullRes = await supabase
    .from("doctor_settings")
    .select(SETTINGS_SELECT_FULL)
    .in("doctor_id", uniqueIds);
  error = fullRes.error;
  rows = fullRes.data as unknown[] | null;

  if (isWeeklyScheduleColumnError(error)) {
    const fallbackRes = await supabase
      .from("doctor_settings")
      .select(SETTINGS_SELECT_FALLBACK)
      .in("doctor_id", uniqueIds);
    error = fallbackRes.error;
    rows = fallbackRes.data as unknown[] | null;
  }

  if (error) {
    console.error("[DocCy] batch doctor_settings lookup failed:", error);
    return byId;
  }

  for (const row of rows ?? []) {
    const id = String((row as { doctor_id?: string }).doctor_id ?? "").trim();
    if (!id) continue;
    byId.set(id, toDoctorSettingsForSlots(row as DoctorSettingsRow));
  }

  return byId;
}
