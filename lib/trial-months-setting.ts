import type { SupabaseClient } from "@supabase/supabase-js";

import { parseTrialMonths } from "@/lib/pro-access";

/**
 * The free-trial length, `app_settings.trial_months` (whole months, 0–24, checked by
 * the database too). Founders change it in the internal dashboard; approving a
 * registration reads it, unless the founder overrides it for that one approval.
 * `app_settings` is service role only (RLS on, no policies).
 */

const KEY = "trial_months";

export type TrialMonthsResult = { ok: true; months: number } | { ok: false; error: string };

export async function loadTrialMonths(service: SupabaseClient): Promise<TrialMonthsResult> {
  const { data, error } = await service
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const months = parseTrialMonths(data?.value);
  if (months == null) return { ok: false, error: "trial_months is missing or invalid" };
  return { ok: true, months };
}

export async function saveTrialMonths(
  service: SupabaseClient,
  months: number,
  adminId: string,
): Promise<TrialMonthsResult> {
  const { data, error } = await service
    .from("app_settings")
    .update({ value: months, updated_at: new Date().toISOString(), updated_by: adminId })
    .eq("key", KEY)
    .select("value")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const saved = parseTrialMonths(data?.value);
  if (saved == null) return { ok: false, error: "trial_months row not found" };
  return { ok: true, months: saved };
}
