import {
  DOCTOR_LOCATION_SELECT,
  sortDoctorLocations,
  type DoctorLocationRow,
} from "@/lib/doctor-locations";
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

/**
 * Clinics being set up, which have no join row yet.
 *
 * "Add clinic" in settings creates a location with no address and no district, and the
 * professional fills the address in afterwards through the wizard. D1's mirror cannot
 * represent that: a join row needs a clinic, and `clinics.district` is NOT NULL, so
 * there is nothing to point at until an address exists. Reading only the join rows
 * would make the new tab vanish the moment it was added.
 *
 * So these rows still come from `doctor_locations` — only the ones the mirror skips,
 * which are exactly the ones that are not yet a place a patient could be sent to.
 * D3/D4 remove this bridge, when adding a clinic means choosing one up front.
 */
const PENDING_LOCATION_FILTER = "clinic_address.is.null,district.is.null";

function locationsFromRows(data: unknown[] | null): DoctorLocationRow[] {
  const rows = (data ?? []) as ProfessionalClinicJoinRow[];
  const locations: DoctorLocationRow[] = [];
  for (const row of rows) {
    const location = professionalClinicRowToLocation(row);
    if (location && location.id && location.doctor_id) locations.push(location);
  }
  return sortDoctorLocations(locations);
}

function mergePendingLocations(
  locations: readonly DoctorLocationRow[],
  pendingData: unknown[] | null,
): DoctorLocationRow[] {
  const known = new Set(locations.map((row) => row.id));
  const pending = ((pendingData ?? []) as DoctorLocationRow[]).filter(
    (row) => row?.id && !known.has(row.id),
  );
  if (pending.length === 0) return [...locations];
  return sortDoctorLocations([...locations, ...pending]);
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

  const locations = locationsFromRows(data);

  const pending = await fetchAllSupabaseRows(() =>
    supabase
      .from("doctor_locations")
      .select(DOCTOR_LOCATION_SELECT)
      .eq("doctor_id", id)
      .or(PENDING_LOCATION_FILTER),
  );
  if (pending.error) {
    console.error("[DocCy] loadDoctorLocations pending clinics failed:", pending.error);
    return locations;
  }

  return mergePendingLocations(locations, pending.data);
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

  const pending = await fetchAllSupabaseRowsForIdChunks(uniqueIds, (chunk) =>
    supabase
      .from("doctor_locations")
      .select(DOCTOR_LOCATION_SELECT)
      .in("doctor_id", chunk)
      .or(PENDING_LOCATION_FILTER),
  );
  if (pending.error) {
    console.error("[DocCy] loadDoctorLocationsByDoctorIds pending clinics failed:", pending.error);
  } else {
    const pendingByDoctor = new Map<string, DoctorLocationRow[]>();
    for (const row of (pending.data ?? []) as DoctorLocationRow[]) {
      const doctorId = String(row?.doctor_id ?? "").trim();
      if (!doctorId) continue;
      const list = pendingByDoctor.get(doctorId) ?? [];
      list.push(row);
      pendingByDoctor.set(doctorId, list);
    }
    for (const [doctorId, rows] of pendingByDoctor) {
      byDoctor.set(doctorId, mergePendingLocations(byDoctor.get(doctorId) ?? [], rows));
    }
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
