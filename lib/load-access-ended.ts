import type { SupabaseClient } from "@supabase/supabase-js";

import { hasProAccess } from "@/lib/pro-access";

/**
 * True when the professional's pro access has ended (user, 2026-10-02): the screens then
 * stop offering new bookings and the Settings toggles. Display only, the booking routes
 * enforce it. Fails open (false) when the lookup fails, so a read error never locks anyone out.
 */
export async function loadProAccessEnded(
  supabase: SupabaseClient<any, any, any>,
  professionalId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { data, error } = await supabase
    .from("professionals")
    .select("pro_access_until")
    .eq("id", professionalId)
    .maybeSingle();
  if (error || !data) return false;
  return !hasProAccess((data as { pro_access_until?: string | null }).pro_access_until, now);
}
