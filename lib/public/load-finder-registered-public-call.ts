import { cache } from "react";

import { publicPhoneForProfessional } from "@/lib/public-call-phone";
import { loadDoctorLocationsByDoctorIds } from "@/lib/load-doctor-locations";
import { fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";
import { createServiceRoleClient } from "@/lib/supabase-service";

type PublicCallRow = {
  id: string;
  phone?: string | null;
  mobile_number?: string | null;
  professional_settings?:
    | { show_phone_public?: boolean | null; public_phone_source?: string | null }
    | { show_phone_public?: boolean | null; public_phone_source?: string | null }[]
    | null;
};

function nestedSettings(
  row: PublicCallRow,
): { show_phone_public?: boolean | null; public_phone_source?: string | null } | null {
  const nested = row.professional_settings;
  if (!nested) return null;
  return Array.isArray(nested) ? nested[0] ?? null : nested;
}

function rowHasPublicCall(row: PublicCallRow, pauseFlags: readonly boolean[]): boolean {
  const settings = nestedSettings(row);
  // Same rule as the profile page and the reveal API: a clinic that takes no online
  // bookings shows the phone, so a professional who never configured anything is still
  // reachable from the card.
  return (
    publicPhoneForProfessional({
      showPhonePublic: settings?.show_phone_public,
      publicPhoneSource: settings?.public_phone_source,
      phone: row.phone,
      mobileNumber: row.mobile_number,
      pauseFlags,
    }) !== null
  );
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
        .select("id, phone, mobile_number, professional_settings(show_phone_public, public_phone_source)")
        .in("id", chunk),
    );
    if (
      result.error &&
      /public_phone_source|mobile_number/i.test(String(result.error.message ?? ""))
    ) {
      result = await fetchAllSupabaseRowsForIdChunks<PublicCallRow>(ids, (chunk) =>
        supabase
          .from("professionals")
          .select("id, phone, professional_settings(show_phone_public)")
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

    const clinicsByProfessional = await loadDoctorLocationsByDoctorIds(supabase, ids);

    const out = new Set<string>();
    for (const row of result.data ?? []) {
      const id = String(row.id ?? "").trim();
      if (!id) continue;
      const pauseFlags = (clinicsByProfessional.get(id) ?? []).map((clinic) =>
        Boolean(clinic.pause_online_bookings),
      );
      if (!rowHasPublicCall(row, pauseFlags)) continue;
      out.add(id);
    }
    return out;
  },
);
