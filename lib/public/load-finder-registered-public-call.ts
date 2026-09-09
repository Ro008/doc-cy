import { cache } from "react";

import { callNumberForSource, parsePublicPhoneSource } from "@/lib/public-call-phone";
import { fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";
import { createServiceRoleClient } from "@/lib/supabase-service";

type PublicCallRow = {
  id: string;
  phone?: string | null;
  mobile_number?: string | null;
  doctor_settings?:
    | { show_phone_public?: boolean | null; public_phone_source?: string | null }
    | { show_phone_public?: boolean | null; public_phone_source?: string | null }[]
    | null;
};

function nestedSettings(
  row: PublicCallRow,
): { show_phone_public?: boolean | null; public_phone_source?: string | null } | null {
  const nested = row.doctor_settings;
  if (!nested) return null;
  return Array.isArray(nested) ? nested[0] ?? null : nested;
}

function rowHasPublicCall(row: PublicCallRow): boolean {
  const settings = nestedSettings(row);
  if (!settings?.show_phone_public) return false;
  const callNumber = callNumberForSource({
    source: parsePublicPhoneSource(settings.public_phone_source),
    mobileNumber: row.mobile_number,
    directoryPhone: row.phone,
  });
  return callNumber.length > 0;
}

export const loadFinderRegisteredPublicCallIds = cache(
  async (doctorIdsKey: string): Promise<Set<string>> => {
    const ids = doctorIdsKey.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return new Set();
    const supabase = createServiceRoleClient();
    if (!supabase) return new Set();

    let result = await fetchAllSupabaseRowsForIdChunks<PublicCallRow>(ids, (chunk) =>
      supabase
        .from("professionals")
        .select("id, phone, mobile_number, doctor_settings(show_phone_public, public_phone_source)")
        .in("id", chunk),
    );
    if (
      result.error &&
      /public_phone_source|mobile_number/i.test(String(result.error.message ?? ""))
    ) {
      result = await fetchAllSupabaseRowsForIdChunks<PublicCallRow>(ids, (chunk) =>
        supabase
          .from("professionals")
          .select("id, phone, doctor_settings(show_phone_public)")
          .in("id", chunk),
      );
    }

    if (result.error) {
      console.error(
        "[DocCy][finder] registered_public_call_lookup_failed",
        result.error.message,
      );
      return new Set();
    }

    const out = new Set<string>();
    for (const row of result.data ?? []) {
      if (!rowHasPublicCall(row)) continue;
      const id = String(row.id ?? "").trim();
      if (id) out.add(id);
    }
    return out;
  },
);
