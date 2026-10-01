import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACCOUNT_SETTINGS_FALLBACK,
  locationToSettingsRow,
  sortDoctorLocations,
  type DoctorLocationRow,
} from "@/lib/doctor-locations";
import type { DoctorSettingsRow } from "@/lib/doctor-settings";

/**
 * `professional_settings` holds professional-level settings only (Point E6, user
 * 2026-10-01): holiday, booking horizon, minimum notice. The schedule (days, hours, break,
 * slot length, pause) lives on each clinic link (`professional_clinics`), so a schedule is
 * always "this professional at this clinic": `settingsAtClinic`.
 */
export const PROFESSIONAL_ACCOUNT_SETTINGS_SELECT =
  "professional_id, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours";

export type ProfessionalAccountSettings = Pick<
  DoctorSettingsRow,
  | "professional_id"
  | "holiday_mode_enabled"
  | "holiday_start_date"
  | "holiday_end_date"
  | "booking_horizon_days"
  | "minimum_notice_hours"
>;

const DEFAULT_SLOT_MINUTES = 30;

/** The appointment's clinic when it is still linked, else the primary clinic. */
export function clinicForAppointment(
  locations: readonly DoctorLocationRow[],
  locationId?: string | null,
): DoctorLocationRow | null {
  const id = String(locationId ?? "").trim();
  const requested = id ? locations.find((row) => row.id === id) : undefined;
  return requested ?? sortDoctorLocations(locations)[0] ?? null;
}

/** The clinic's schedule merged with the account settings; null without a clinic. */
export function settingsAtClinic(
  account: Omit<ProfessionalAccountSettings, "professional_id"> | null | undefined,
  locations: readonly DoctorLocationRow[],
  locationId?: string | null,
): DoctorSettingsRow | null {
  const clinic = clinicForAppointment(locations, locationId);
  if (!clinic) return null;
  return locationToSettingsRow(clinic, account ?? ACCOUNT_SETTINGS_FALLBACK);
}

/** Slot length for an appointment: its clinic's, else the primary clinic's, else 30. */
export function clinicSlotMinutes(
  locations: readonly DoctorLocationRow[],
  locationId?: string | null,
): number {
  const minutes = Number(clinicForAppointment(locations, locationId)?.slot_duration_minutes);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_SLOT_MINUTES;
}

export async function loadProfessionalAccountSettings(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<{ settings: ProfessionalAccountSettings | null; error: unknown }> {
  const { data, error } = await supabase
    .from("professional_settings")
    .select(PROFESSIONAL_ACCOUNT_SETTINGS_SELECT)
    .eq("professional_id", professionalId)
    .maybeSingle();
  return { settings: (data as ProfessionalAccountSettings | null) ?? null, error };
}

/** One round-trip for many professionals (finder cards). */
export async function loadProfessionalAccountSettingsByIds(
  supabase: SupabaseClient,
  professionalIds: readonly string[],
): Promise<Map<string, ProfessionalAccountSettings>> {
  const uniqueIds = Array.from(new Set(professionalIds.filter(Boolean)));
  const byId = new Map<string, ProfessionalAccountSettings>();
  if (uniqueIds.length === 0) return byId;

  const { data, error } = await supabase
    .from("professional_settings")
    .select(PROFESSIONAL_ACCOUNT_SETTINGS_SELECT)
    .in("professional_id", uniqueIds);
  if (error) {
    console.error("[DocCy] batch professional_settings lookup failed:", error);
    return byId;
  }
  for (const row of (data ?? []) as ProfessionalAccountSettings[]) {
    if (row.professional_id) byId.set(String(row.professional_id), row);
  }
  return byId;
}
