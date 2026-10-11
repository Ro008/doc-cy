import { compareClinicOrder } from "@/lib/clinic-order";
import { formatCyprusPhoneDisplay } from "@/lib/phone-link";
import { createServiceRoleClient } from "@/lib/supabase-service";

/** One of the professional's clinics and the phone patients see for it. */
export type SettingsClinicPhone = {
  clinicId: string;
  /** The professional's link to the clinic (professional_clinics.id = doctor_locations.id). */
  locationId: string;
  name: string;
  /** Display format (+357 XX XXXXXX); "" when the clinic has no phone yet. */
  phone: string;
};

type JoinRow = {
  id?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  clinics?:
    | { id?: string | null; name?: string | null; phone?: string | null; is_archived?: boolean | null }
    | { id?: string | null; name?: string | null; phone?: string | null; is_archived?: boolean | null }[]
    | null;
};

/**
 * The clinic phones on a professional's clinic cards in Settings (user, 2026-09-29 and
 * 2026-10-10): the public Call buttons show `clinics.phone`, and clinics are
 * admin-curated, so she asks DocCy to change one. In her clinic order, archived
 * clinics left out.
 */
export async function loadSettingsClinicPhones(
  professionalId: string,
): Promise<SettingsClinicPhone[]> {
  const supabase = createServiceRoleClient();
  if (!supabase || !professionalId) return [];
  const { data, error } = await supabase
    .from("professional_clinics")
    .select("id, sort_order, created_at, clinics ( id, name, phone, is_archived )")
    .eq("professional_id", professionalId);
  if (error) {
    console.error("[DocCy] settings clinic phones load failed:", error.message);
    return [];
  }
  const rows = [...((data ?? []) as unknown as JoinRow[])].sort(compareClinicOrder);
  const out: SettingsClinicPhone[] = [];
  for (const row of rows) {
    const clinic = Array.isArray(row.clinics) ? row.clinics[0] : row.clinics;
    const clinicId = String(clinic?.id ?? "").trim();
    if (!clinic || !clinicId || clinic.is_archived) continue;
    if (out.some((entry) => entry.clinicId === clinicId)) continue;
    const phone = String(clinic.phone ?? "").trim();
    out.push({
      clinicId,
      locationId: String(row.id ?? "").trim(),
      name: String(clinic.name ?? "").trim(),
      phone: phone ? formatCyprusPhoneDisplay(phone) : "",
    });
  }
  return out;
}
