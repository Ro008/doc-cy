import type { SupabaseClient } from "@supabase/supabase-js";
import {
  settingsToWeeklySlots,
  type DoctorSettingsRow,
  type WeeklySlotFromSettings,
} from "@/lib/doctor-settings";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import {
  clinicSlotMinutes,
  loadProfessionalAccountSettings,
  settingsAtClinic,
} from "@/lib/professional-account-settings";

export type DoctorSettingsForSlots = {
  settings: DoctorSettingsRow;
  weeklySlots: WeeklySlotFromSettings[];
  fallbackSlotDurationMinutes: number;
};

/**
 * Bookable schedule of a professional at one clinic: that clinic link's hours, break, slot
 * length and pause, with the account's holiday, horizon and notice (Point E6). Without a
 * location id it is the primary clinic. Null when the professional has no clinic.
 */
export async function loadDoctorSettingsForSlots(
  supabase: SupabaseClient,
  doctorId: string,
  locationId?: string | null,
): Promise<DoctorSettingsForSlots | null> {
  const [{ settings: account, error }, locations] = await Promise.all([
    loadProfessionalAccountSettings(supabase, doctorId),
    loadDoctorLocations(doctorId),
  ]);
  if (error) {
    console.error("[DocCy] professional_settings lookup failed:", error);
    return null;
  }

  const settings = settingsAtClinic(account, locations, locationId);
  if (!settings) return null;

  return {
    settings,
    weeklySlots: settingsToWeeklySlots(settings),
    fallbackSlotDurationMinutes: clinicSlotMinutes(locations, locationId),
  };
}
