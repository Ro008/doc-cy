import { sortDoctorLocations, type DoctorLocationRow } from "@/lib/doctor-locations";
import {
  PROFESSIONAL_CLINIC_LOCATION_SELECT,
  professionalClinicRowToLocation,
  type ProfessionalClinicJoinRow,
} from "@/lib/professional-clinic-locations";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { fetchAllSupabaseRows, fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";

/**
 * Practice locations for registered professionals.
 *
 * Point D2: these read `professional_clinics -> clinics`, not `doctor_locations`.
 * D1's trigger keeps the join row an exact mirror of the location it was created from,
 * including its id, so everything downstream — `?location=<uuid>` links,
 * `appointments.location_id`, agenda clinic colours — keeps resolving.
 *
 * Reads go through the service role with an explicit column list, because
 * `professional_clinics` and `clinics` have RLS enabled with no policies. Callers pass
 * a professional id they have already authorised (a session's own doctor, or a public
 * profile being rendered), exactly as the specialty loaders do since Point C.
 *
 * Scraped GeSY listings have join rows too, and those are not practice locations: they
 * are workplaces the directory lists. Only registered professionals are returned, which
 * is what `doctor_locations` meant.
 */

function locationsFromRows(data: unknown[] | null): DoctorLocationRow[] {
  const rows = (data ?? []) as ProfessionalClinicJoinRow[];
  const locations: DoctorLocationRow[] = [];
  for (const row of rows) {
    const location = professionalClinicRowToLocation(row);
    if (location && location.id && location.doctor_id) locations.push(location);
  }
  return sortDoctorLocations(locations);
}

export async function loadDoctorLocations(professionalId: string): Promise<DoctorLocationRow[]> {
  const id = String(professionalId ?? "").trim();
  if (!id) return [];

  const supabase = createServiceRoleClient();
  if (!supabase) {
    console.error("[DocCy] loadDoctorLocations: no service role client");
    return [];
  }

  const { data, error } = await fetchAllSupabaseRows(() =>
    supabase
      .from("professional_clinics")
      .select(`${PROFESSIONAL_CLINIC_LOCATION_SELECT}, professionals!inner ( is_registered )`)
      .eq("professional_id", id)
      .eq("professionals.is_registered", true)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true }),
  );

  if (error) {
    console.error("[DocCy] loadDoctorLocations failed:", error);
    return [];
  }
  return locationsFromRows(data);
}

export async function loadDoctorLocationsByDoctorIds(
  professionalIds: readonly string[],
): Promise<Map<string, DoctorLocationRow[]>> {
  const uniqueIds = Array.from(new Set(professionalIds.filter(Boolean)));
  const byDoctor = new Map<string, DoctorLocationRow[]>();
  if (uniqueIds.length === 0) return byDoctor;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    console.error("[DocCy] loadDoctorLocationsByDoctorIds: no service role client");
    return byDoctor;
  }

  const { data, error } = await fetchAllSupabaseRowsForIdChunks(uniqueIds, (chunk) =>
    supabase
      .from("professional_clinics")
      .select(`${PROFESSIONAL_CLINIC_LOCATION_SELECT}, professionals!inner ( is_registered )`)
      .in("professional_id", chunk)
      .eq("professionals.is_registered", true),
  );

  if (error) {
    console.error("[DocCy] loadDoctorLocationsByDoctorIds failed:", error);
    return byDoctor;
  }

  for (const row of locationsFromRows(data)) {
    const list = byDoctor.get(row.doctor_id) ?? [];
    list.push(row);
    byDoctor.set(row.doctor_id, list);
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
