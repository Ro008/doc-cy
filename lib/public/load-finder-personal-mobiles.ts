import { cache } from "react";

import {
  finderPersonalMobileShownIds,
  type ProfessionalRow,
  type SettingsRow,
} from "@/lib/public/finder-personal-mobiles";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";

/** Request-memoized on the availability batch's `doctorIdsKey`, so the cards share one read. */
export const loadFinderPersonalMobileIds = cache(async (doctorIdsKey: string): Promise<Set<string>> => {
  const ids = doctorIdsKey.split(",").map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return new Set();
  const supabase = createServiceRoleClient();
  if (!supabase) return new Set();

  const [professionals, settings] = await Promise.all([
    fetchAllSupabaseRowsForIdChunks(ids, (idChunk) =>
      supabase.from("professionals").select("id, mobile_number, is_registered, is_archived").in("id", idChunk),
    ),
    fetchAllSupabaseRowsForIdChunks(ids, (idChunk) =>
      supabase
        .from("professional_settings")
        .select("professional_id, show_mobile_on_profile")
        .in("professional_id", idChunk),
    ),
  ]);
  if (professionals.error || settings.error) {
    console.error(
      "[DocCy] finder personal mobiles load failed:",
      professionals.error ?? settings.error,
    );
    return new Set();
  }
  return finderPersonalMobileShownIds(
    (professionals.data ?? []) as ProfessionalRow[],
    (settings.data ?? []) as SettingsRow[],
  );
});
