/**
 * Writes to a professional's specialties (`professional_specialties`), the source of
 * truth since Point C2b and the only copy since Point C3. A BEFORE trigger on the
 * table resolves `specialty_id` from the label.
 *
 * Rows are matched by slug, the key the table is unique on, so a label that differs
 * only in case or punctuation updates the existing row instead of clashing with it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { specialtyToSlug } from "@/lib/finder-seo";

export type ProfessionalSpecialtyRow = {
  id: string;
  professional_id: string;
  specialty: string;
  license_number: string | null;
  is_approved: boolean;
};

const ROW_SELECT = "id, professional_id, specialty, license_number, is_approved";

export async function loadProfessionalSpecialtyRows(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<{ rows: ProfessionalSpecialtyRow[]; error: unknown }> {
  const { data, error } = await supabase
    .from("professional_specialties")
    .select(ROW_SELECT)
    .eq("professional_id", professionalId)
    .order("created_at");
  return { rows: (data ?? []) as ProfessionalSpecialtyRow[], error };
}

export function sameSpecialtySlug(a: string, b: string): boolean {
  return specialtyToSlug(a) === specialtyToSlug(b);
}

/** Adds the specialty, or updates the professional's row with the same slug. */
export async function upsertProfessionalSpecialty(
  supabase: SupabaseClient,
  input: {
    professionalId: string;
    specialty: string;
    licenseNumber: string | null;
    isApproved: boolean;
  },
): Promise<{ error: unknown }> {
  const { rows, error: loadError } = await loadProfessionalSpecialtyRows(
    supabase,
    input.professionalId,
  );
  if (loadError) return { error: loadError };

  const values = {
    specialty: input.specialty,
    license_number: input.licenseNumber,
    is_approved: input.isApproved,
  };
  const existing = rows.find((row) => sameSpecialtySlug(row.specialty, input.specialty));
  const { error } = existing
    ? await supabase.from("professional_specialties").update(values).eq("id", existing.id)
    : await supabase
        .from("professional_specialties")
        .insert({ professional_id: input.professionalId, ...values });
  return { error };
}

/** Deletes the professional's row(s) with the same slug as `specialty`. */
export async function deleteProfessionalSpecialty(
  supabase: SupabaseClient,
  professionalId: string,
  specialty: string,
): Promise<{ error: unknown }> {
  const { rows, error: loadError } = await loadProfessionalSpecialtyRows(supabase, professionalId);
  if (loadError) return { error: loadError };
  const ids = rows.filter((row) => sameSpecialtySlug(row.specialty, specialty)).map((row) => row.id);
  if (ids.length === 0) return { error: null };
  const { error } = await supabase.from("professional_specialties").delete().in("id", ids);
  return { error };
}
