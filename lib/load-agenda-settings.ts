import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgendaWorkingHours } from "@/lib/agenda-clinics";
import { buildWeeklyScheduleFromSettings, type DoctorSettingsRow } from "@/lib/doctor-settings";

const SETTINGS_COLUMNS =
  "professional_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, break_start, break_end, pause_online_bookings, show_phone_public, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours, slot_duration_minutes";

export type AgendaSettings = {
  workingHours: AgendaWorkingHours | null;
  pauseOnlineBookings: boolean;
};

/** Doctor-level working hours for the agenda and dashboard (older DBs lack `weekly_schedule`). */
export async function loadAgendaSettings(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<AgendaSettings> {
  let settingsRes = await supabase
    .from("professional_settings")
    .select(`${SETTINGS_COLUMNS}, weekly_schedule`)
    .eq("professional_id", professionalId)
    .single();

  const weeklyMissing =
    settingsRes.error &&
    (String(settingsRes.error.message ?? "")
      .toLowerCase()
      .includes("weekly_schedule") ||
      (settingsRes.error as { code?: string }).code === "42703");

  if (weeklyMissing) {
    settingsRes = await supabase
      .from("professional_settings")
      .select(SETTINGS_COLUMNS)
      .eq("professional_id", professionalId)
      .single();
  }

  if (settingsRes.error || !settingsRes.data) {
    return { workingHours: null, pauseOnlineBookings: false };
  }

  const s = settingsRes.data as DoctorSettingsRow;
  return {
    workingHours: {
      weeklySchedule: buildWeeklyScheduleFromSettings({
        ...s,
        weekly_schedule: s.weekly_schedule ?? null,
        show_phone_public: Boolean((s as { show_phone_public?: boolean | null }).show_phone_public),
      }),
      breakStart: (s.break_start ?? null) as string | null,
      breakEnd: (s.break_end ?? null) as string | null,
      slotDurationMinutes:
        (s as { slot_duration_minutes?: number | null }).slot_duration_minutes ?? 30,
    },
    pauseOnlineBookings: Boolean(
      (s as { pause_online_bookings?: boolean | null }).pause_online_bookings,
    ),
  };
}
