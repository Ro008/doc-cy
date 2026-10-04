import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { settingsToWeeklySlots, type DoctorSettingsRow } from "@/lib/doctor-settings";
import { loadDoctorSettingsForSlots } from "@/lib/load-doctor-settings-for-slots";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { ACCOUNT_SETTINGS_FALLBACK, locationToSettingsRow } from "@/lib/doctor-locations";
import {
  OCCUPIED_BATCH_RPC,
  takenSlotTimesFor,
  type OccupiedRow,
} from "@/lib/public/load-doctor-next-available-slot";

/** What BookingSection needs to show the professional's online booking calendar. */
export type RescheduleCalendarData = {
  weeklySlots: ReturnType<typeof settingsToWeeklySlots>;
  takenSlotTimes: string[];
  breakStart?: string;
  breakEnd?: string;
  onlineBookingsPaused: boolean;
  holidayModeEnabled: boolean;
  holidayStartDate: string | null;
  holidayEndDate: string | null;
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  locationId: string | null;
};

/**
 * Same calendar the public profile shows (same settings, same clinic, same busy times),
 * for "See other times" on the reschedule email-link page.
 */
export async function loadRescheduleCalendar(
  supabase: SupabaseClient,
  opts: { doctorId: string; locationId: string | null },
): Promise<RescheduleCalendarData | null> {
  const loaded = await loadDoctorSettingsForSlots(supabase, opts.doctorId);
  const accountSettings: DoctorSettingsRow | null = loaded?.settings ?? null;

  const locations = opts.locationId ? await loadDoctorLocations(opts.doctorId) : [];
  const location = locations.find((row) => row.id === opts.locationId) ?? null;
  const settings: DoctorSettingsRow | null = location
    ? locationToSettingsRow(location, accountSettings ?? ACCOUNT_SETTINGS_FALLBACK)
    : accountSettings;
  if (!settings) return null;

  const horizonRaw = accountSettings?.booking_horizon_days ?? 90;
  const bookingHorizonDays = [14, 30, 90, 180].includes(horizonRaw) ? horizonRaw : 90;

  // Busy instants, exactly like the profile (and POST /api/appointments) sees them.
  const nowUtc = new Date();
  const fromIso = new Date(nowUtc.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const lastBookableDay = addDays(utcToZonedTime(nowUtc, CY_TZ), bookingHorizonDays);
  const toIso = zonedTimeToUtc(
    `${format(addDays(lastBookableDay, 1), "yyyy-MM-dd")}T23:59:59.999`,
    CY_TZ,
  ).toISOString();
  const { data: occupiedRows, error: occupiedErr } = await supabase.rpc(OCCUPIED_BATCH_RPC, {
    p_professional_ids: [opts.doctorId],
    p_from: fromIso,
    p_to: toIso,
  });
  if (occupiedErr) {
    console.error("[DocCy] reschedule calendar: occupied datetimes failed", occupiedErr);
  }
  // No clinic filter: a visit in any clinic blocks the time (one professional, one agenda).
  const takenSlotTimes = takenSlotTimesFor((occupiedRows ?? []) as OccupiedRow[], {
    professionalId: opts.doctorId,
    toIso,
  });

  return {
    weeklySlots: settingsToWeeklySlots(settings),
    takenSlotTimes,
    breakStart: settings.break_start ? settings.break_start.slice(0, 5) : undefined,
    breakEnd: settings.break_end ? settings.break_end.slice(0, 5) : undefined,
    onlineBookingsPaused: Boolean(settings.pause_online_bookings),
    holidayModeEnabled: Boolean(accountSettings?.holiday_mode_enabled),
    holidayStartDate: accountSettings?.holiday_start_date ?? null,
    holidayEndDate: accountSettings?.holiday_end_date ?? null,
    bookingHorizonDays,
    minimumNoticeHours: accountSettings?.minimum_notice_hours ?? 2,
    locationId: location?.id ?? null,
  };
}
