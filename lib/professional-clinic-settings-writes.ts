import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Point D3a: where a clinic save lands.
 *
 * A professional's own settings at a clinic — hours, breaks, slot length, label and the
 * bookings pause — belong to their professional_clinics row. Every professional at a
 * clinic has their own row, so two doctors sharing a clinic keep their own hours.
 *
 * Which clinic it is, and its address, still live on doctor_locations until the
 * registration redesign moves them behind admin review. One save from the settings
 * page carries both, so it is split here. The D1 trigger mirrors the location half;
 * it only copies settings that changed on the location itself, so a later address
 * edit can never overwrite what was saved here.
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

const SETTINGS = new Set<string>(CLINIC_SETTINGS_COLUMNS);

/** Never written through a clinic save: identity, ownership, and bookkeeping. */
const NEVER_WRITTEN = new Set(["id", "doctor_id", "professional_id", "clinic_id", "updated_at", "created_at"]);

export function splitLocationPatch(patch: Record<string, unknown>): {
  settings: Partial<Record<ClinicSettingsColumn, unknown>>;
  location: Record<string, unknown>;
} {
  const settings: Partial<Record<ClinicSettingsColumn, unknown>> = {};
  const location: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || NEVER_WRITTEN.has(key)) continue;
    if (SETTINGS.has(key)) settings[key as ClinicSettingsColumn] = value;
    else location[key] = value;
  }
  return { settings, location };
}

export type ClinicSettingsWriteResult = {
  ok: boolean;
  /** Where the settings landed when `ok`. */
  savedOn?: "join_row" | "location" | "nothing";
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
 *
 * A clinic still being set up (added, but no address yet) has no join row, so its
 * settings stay on the location row. When it gets an address, the mirror creates the
 * join row and seeds it from there.
 */
export async function writeClinicSettings(
  professionalId: string,
  locationId: string,
  settings: Partial<Record<ClinicSettingsColumn, unknown>>,
): Promise<ClinicSettingsWriteResult> {
  const pro = String(professionalId ?? "").trim();
  const id = String(locationId ?? "").trim();
  if (!pro || !id) return { ok: false, error: "missing_ids" };
  if (Object.keys(settings).length === 0) return { ok: true, savedOn: "nothing" };

  const supabase = createServiceRoleClient();
  if (!supabase) return { ok: false, error: "no_service_role" };

  const updatedAt = new Date().toISOString();

  const joinRow = await supabase
    .from("professional_clinics")
    .update({ ...settings, updated_at: updatedAt })
    .eq("id", id)
    .eq("professional_id", pro)
    .select("id");
  if (joinRow.error) return { ok: false, error: joinRow.error.message };
  if ((joinRow.data ?? []).length > 0) return { ok: true, savedOn: "join_row" };

  const pending = await supabase
    .from("doctor_locations")
    .update({ ...settings, updated_at: updatedAt })
    .eq("id", id)
    .eq("doctor_id", pro)
    .select("id");
  if (pending.error) return { ok: false, error: pending.error.message };
  if ((pending.data ?? []).length > 0) return { ok: true, savedOn: "location" };

  return { ok: false, error: "not_found" };
}
