import type { SupabaseClient } from "@supabase/supabase-js";
import type { PastVisitFacetRow } from "@/lib/past-visits-view";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";
import { createServiceRoleClient } from "@/lib/supabase-service";

/** Server-only loaders for the Visits tab (user, 2026-10-13); the pure parts are in lib/past-visits-view. */

/**
 * Every past visit of hers, as little of it as the filters and the per-patient counts need
 * (lib/past-visits-view `pastVisitFacets`, `patientVisitCounts`): the clinics and services come
 * from her visits, not from what she offers today, so one she has left or renamed still shows.
 */
export async function loadPastVisitFacetRows(
  supabase: SupabaseClient,
  professionalId: string,
  now: Date = new Date(),
): Promise<PastVisitFacetRow[]> {
  const { data, error } = await fetchAllSupabaseRows<PastVisitFacetRow>(() =>
    supabase
      .from("appointments")
      .select("clinic_id, service_name, patient_email, patient_phone")
      .eq("professional_id", professionalId)
      .eq("status", "CONFIRMED")
      .lte("appointment_datetime", now.toISOString())
      .order("appointment_datetime", { ascending: false })
      .order("id", { ascending: true }),
  );
  if (error) console.error("[DocCy] loadPastVisitFacetRows failed", error.code ?? "unknown");
  return data ?? [];
}

/**
 * Names of the clinics of her visits, by `clinics.id`. Through the service role with an explicit
 * column list (`clinics` has RLS and no policies); the ids come from her own visits.
 */
export async function loadVisitClinicNames(clinicIds: readonly string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(clinicIds.filter(Boolean)));
  const admin = createServiceRoleClient();
  if (ids.length === 0 || !admin) return {};
  const { data, error } = await admin.from("clinics").select("id, name").in("id", ids);
  if (error) {
    console.error("[DocCy] loadVisitClinicNames failed", error.code ?? "unknown");
    return {};
  }
  const names: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; name: string | null }[]) {
    const name = row.name?.trim();
    if (name) names[row.id] = name;
  }
  return names;
}
