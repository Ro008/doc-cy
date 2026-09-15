import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

/**
 * Distinct active professionals per clinic (N:M `professional_clinics` + legacy
 * `professionals.clinic_id`). Two unbounded reads — do not chunk by clinic id.
 */
export async function loadClinicProfessionalCountById(
  supabase: SupabaseClient,
): Promise<{ data: Map<string, number>; error: string | null }> {
  const [linksRes, prosRes] = await Promise.all([
    fetchAllSupabaseRows<{ clinic_id: string | null; professional_id: string | null }>(() =>
      supabase.from("professional_clinics").select("clinic_id, professional_id"),
    ),
    fetchAllSupabaseRows<{ id: string; clinic_id: string | null }>(() =>
      supabase.from("professionals").select("id, clinic_id").eq("is_archived", false),
    ),
  ]);

  if (linksRes.error) {
    return { data: new Map(), error: linksRes.error.message ?? "professional_clinics_load_failed" };
  }
  if (prosRes.error) {
    return { data: new Map(), error: prosRes.error.message ?? "professionals_load_failed" };
  }

  const idsByClinic = new Map<string, Set<string>>();
  const add = (clinicId: string, professionalId: string) => {
    if (!clinicId || !professionalId) return;
    let set = idsByClinic.get(clinicId);
    if (!set) {
      set = new Set();
      idsByClinic.set(clinicId, set);
    }
    set.add(professionalId);
  };

  const activeProfessionalIds = new Set<string>();
  for (const row of prosRes.data ?? []) {
    const professionalId = String(row.id ?? "").trim();
    const clinicId = String(row.clinic_id ?? "").trim();
    if (professionalId) activeProfessionalIds.add(professionalId);
    if (clinicId && professionalId) add(clinicId, professionalId);
  }

  for (const row of linksRes.data ?? []) {
    const clinicId = String(row.clinic_id ?? "").trim();
    const professionalId = String(row.professional_id ?? "").trim();
    if (!activeProfessionalIds.has(professionalId)) continue;
    add(clinicId, professionalId);
  }

  const counts = new Map<string, number>();
  for (const [clinicId, ids] of idsByClinic) {
    counts.set(clinicId, ids.size);
  }
  return { data: counts, error: null };
}
