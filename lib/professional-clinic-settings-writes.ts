import { locationScheduleColumns, sanitizeClinicLabel } from "@/lib/doctor-locations";
import type { WeeklySchedule } from "@/lib/doctor-settings";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Where a clinic save lands.
 *
 * A professional's own settings at a clinic — hours, breaks, slot length, label and the
 * bookings pause — belong to their professional_clinics row. Every professional at a
 * clinic has their own row, so two doctors sharing a clinic keep their own hours.
 *
 * D4 (user, 2026-09-30): the clinic itself — which one, and its address — is read-only
 * in settings. Clinics are curated by DocCy; joining, leaving, creating and editing
 * clinics come back with Ro008's settings screens and their requests. So a save only
 * ever carries these settings, and nothing writes `doctor_locations` any more.
 */

export const CLINIC_SETTINGS_COLUMNS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "start_time",
  "end_time",
  "weekly_schedule",
  "break_start",
  "break_end",
  "slot_duration_minutes",
  "label",
  "pause_online_bookings",
] as const;

export type ClinicSettingsColumn = (typeof CLINIC_SETTINGS_COLUMNS)[number];

export type ClinicSettingsPatch = Partial<Record<ClinicSettingsColumn, unknown>>;

const SETTINGS = new Set<string>(CLINIC_SETTINGS_COLUMNS);

/** Only the per-clinic settings of a patch: never an address, an id or bookkeeping. */
export function clinicSettingsPatch(patch: Record<string, unknown>): ClinicSettingsPatch {
  const settings: ClinicSettingsPatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || !SETTINGS.has(key)) continue;
    settings[key as ClinicSettingsColumn] = value;
  }
  return settings;
}

/** One clinic as the settings page sends it. Address fields may be present; they are ignored. */
export type SettingsClinicInput = {
  id?: string;
  label?: string | null;
  weeklySchedule?: WeeklySchedule;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  breakEnabled?: boolean;
  breakStart?: string;
  breakEnd?: string;
  slotDurationMinutes?: number;
  [ignored: string]: unknown;
};

type OwnedClinic = { id: string; is_primary?: boolean | null; sort_order?: number | null };

function primaryOf(owned: readonly OwnedClinic[]): OwnedClinic | null {
  return (
    [...owned].sort(
      (a, b) =>
        Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) ||
        (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0),
    )[0] ?? null
  );
}

/**
 * What a settings save writes: for each clinic the professional owns, its hours and name.
 * A first entry without an id means the primary clinic (single-clinic pages); ids the
 * professional doesn't own are skipped. The bookings pause has its own toggle and route.
 */
export function settingsSaveTargets(
  inputs: readonly SettingsClinicInput[],
  owned: readonly OwnedClinic[],
): Array<{ locationId: string; settings: ClinicSettingsPatch }> {
  const ownedIds = new Set(owned.map((row) => row.id));
  const targets: Array<{ locationId: string; settings: ClinicSettingsPatch }> = [];
  inputs.forEach((input, index) => {
    const id = String(input?.id ?? "").trim();
    const locationId = ownedIds.has(id) ? id : !id && index === 0 ? primaryOf(owned)?.id : undefined;
    if (!locationId) return;
    const { pause_online_bookings: _pause, ...schedule } = locationScheduleColumns({
      weeklySchedule: input.weeklySchedule,
      monday: input.monday,
      tuesday: input.tuesday,
      wednesday: input.wednesday,
      thursday: input.thursday,
      friday: input.friday,
      saturday: input.saturday,
      sunday: input.sunday,
      breakEnabled: input.breakEnabled,
      breakStart: input.breakStart,
      breakEnd: input.breakEnd,
      slotDurationMinutes: input.slotDurationMinutes,
    });
    const patch: Record<string, unknown> = { ...schedule };
    if (typeof input.label === "string") patch.label = sanitizeClinicLabel(input.label);
    targets.push({ locationId, settings: clinicSettingsPatch(patch) });
  });
  return targets;
}

/** Prefilled "contact us" message from the read-only clinics on the settings page. */
export function clinicChangeContactMessage(clinicNames: readonly string[]): string {
  const names = clinicNames.map((name) => String(name ?? "").trim()).filter(Boolean);
  const what = names.length === 1 ? `my clinic "${names[0]}"` : "my clinics";
  return `Hello, I would like to change ${what}. The change is: `;
}

export type ClinicSettingsWriteResult = {
  ok: boolean;
  /** Where the settings landed when `ok`. */
  savedOn?: "join_row" | "nothing";
  /** Why it failed when not `ok`. */
  error?: string;
};

/**
 * Save a professional's settings at one clinic.
 *
 * Goes through the service role, because professional_clinics has RLS with no
 * policies. Every write is scoped to the professional as well as the row id, so a
 * caller can only ever touch their own clinics; callers pass a professional id they
 * have already resolved from the session.
 */
export async function writeClinicSettings(
  professionalId: string,
  locationId: string,
  settings: ClinicSettingsPatch,
): Promise<ClinicSettingsWriteResult> {
  const pro = String(professionalId ?? "").trim();
  const id = String(locationId ?? "").trim();
  if (!pro || !id) return { ok: false, error: "missing_ids" };
  if (Object.keys(settings).length === 0) return { ok: true, savedOn: "nothing" };

  const supabase = createServiceRoleClient();
  if (!supabase) return { ok: false, error: "no_service_role" };

  const joinRow = await supabase
    .from("professional_clinics")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("professional_id", pro)
    .select("id");
  if (joinRow.error) return { ok: false, error: joinRow.error.message };
  if ((joinRow.data ?? []).length > 0) return { ok: true, savedOn: "join_row" };

  return { ok: false, error: "not_found" };
}
