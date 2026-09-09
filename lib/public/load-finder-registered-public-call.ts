import { cache } from "react";

import { fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Request-memoized ids of registered doctors who opted into a public Call number.
 * Reads `doctors_public` (phone is already gated by `show_phone_public`).
 * Selects only `id` so finder SSR never receives the digits.
 */
export const loadFinderRegisteredPublicCallIds = cache(
  async (doctorIdsKey: string): Promise<Set<string>> => {
    const ids = doctorIdsKey.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return new Set();
    const supabase = createServiceRoleClient();
    if (!supabase) return new Set();

    const { data, error } = await fetchAllSupabaseRowsForIdChunks<{ id: string }>(
      ids,
      (chunk) =>
        supabase
          .from("doctors_public")
          .select("id")
          .in("id", chunk)
          .not("phone", "is", null),
    );
    if (error) {
      console.error(
        "[DocCy][finder] registered_public_call_lookup_failed",
        error.message,
      );
      return new Set();
    }

    const out = new Set<string>();
    for (const row of data ?? []) {
      const id = String(row.id ?? "").trim();
      if (id) out.add(id);
    }
    return out;
  },
);
