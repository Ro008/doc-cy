import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOCTOR_LOCATION_SELECT,
  sortDoctorLocations,
  type DoctorLocationRow,
} from "@/lib/doctor-locations";
import { fetchAllSupabaseRows, fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";

function asLocationRows(data: unknown[] | null): DoctorLocationRow[] {
  return sortDoctorLocations((data ?? []) as DoctorLocationRow[]);
}

export async function loadDoctorLocations(
  supabase: SupabaseClient,
  doctorId: string,
): Promise<DoctorLocationRow[]> {
  const { data, error } = await fetchAllSupabaseRows(() =>
    supabase
      .from("doctor_locations")
      .select(DOCTOR_LOCATION_SELECT)
      .eq("doctor_id", doctorId)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true }),
  );
  if (error) {
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      String(error.message ?? "").toLowerCase().includes("doctor_locations")
    ) {
      return [];
    }
    console.error("[DocCy] loadDoctorLocations failed:", error);
    return [];
  }
  return asLocationRows(data);
}

export async function loadDoctorLocationsByDoctorIds(
  supabase: SupabaseClient,
  doctorIds: readonly string[],
): Promise<Map<string, DoctorLocationRow[]>> {
  const uniqueIds = Array.from(new Set(doctorIds.filter(Boolean)));
  const byDoctor = new Map<string, DoctorLocationRow[]>();
  if (uniqueIds.length === 0) return byDoctor;

  const { data, error } = await fetchAllSupabaseRowsForIdChunks(uniqueIds, (chunk) =>
    supabase
      .from("doctor_locations")
      .select(DOCTOR_LOCATION_SELECT)
      .in("doctor_id", chunk),
  );

  if (error) {
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      String(error.message ?? "").toLowerCase().includes("doctor_locations")
    ) {
      return byDoctor;
    }
    console.error("[DocCy] loadDoctorLocationsByDoctorIds failed:", error);
    return byDoctor;
  }

  for (const row of asLocationRows(data)) {
    const doctorId = String(row.doctor_id ?? "").trim();
    if (!doctorId) continue;
    const list = byDoctor.get(doctorId) ?? [];
    list.push(row);
    byDoctor.set(doctorId, list);
  }

  for (const [doctorId, rows] of byDoctor) {
    byDoctor.set(doctorId, sortDoctorLocations(rows));
  }

  return byDoctor;
}

export function primaryDoctorLocation(
  locations: readonly DoctorLocationRow[],
): DoctorLocationRow | null {
  if (locations.length === 0) return null;
  return sortDoctorLocations(locations)[0] ?? null;
}
