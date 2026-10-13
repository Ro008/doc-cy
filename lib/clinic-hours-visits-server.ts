import type { SupabaseClient } from "@supabase/supabase-js";

import { visitsLeftOutside, type HoursVisitReason, type VisitCounts } from "@/lib/clinic-hours-visits";
import { locationWeeklySchedule } from "@/lib/doctor-locations";
import type { WeeklySchedule } from "@/lib/doctor-settings";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";

export type HoursCheckVisit = {
  id: string;
  /** Start of the visit (ISO). */
  at: string;
  patientName: string;
  /** A request still waiting for her answer (not a confirmed visit). */
  open: boolean;
  reason: HoursVisitReason;
};

export type ClinicHoursCheck = VisitCounts & { locationId: string; clinicName: string; visits: HoursCheckVisit[] };

const VISITS_LISTED = 20;

/**
 * For each of her clinics and the week it is about to get: the confirmed visits and open
 * requests still to come that fit her hours today and would not fit the new ones. A
 * clinic that is not hers is left out. Nothing is cancelled: this only feeds a warning.
 */
export async function loadVisitsLeftOutsideHours(
  service: SupabaseClient,
  input: { professionalId: string; clinics: Array<{ locationId: string; week: WeeklySchedule }>; now?: Date },
): Promise<ClinicHoursCheck[]> {
  const owned = await loadDoctorLocations(input.professionalId);
  const targets = input.clinics
    .map((clinic) => ({ ...clinic, location: owned.find((row) => row.id === clinic.locationId) }))
    .filter((clinic) => clinic.location?.clinic_id);
  if (targets.length === 0) return [];

  const { data, error } = await service
    .from("appointments")
    .select("id, appointment_datetime, patient_name, status, clinic_id")
    .eq("professional_id", input.professionalId)
    .in("clinic_id", targets.map((clinic) => String(clinic.location!.clinic_id)))
    .in("status", ["CONFIRMED", "REQUESTED", "NEEDS_RESCHEDULE"])
    .gt("appointment_datetime", (input.now ?? new Date()).toISOString())
    .order("appointment_datetime", { ascending: true });
  if (error) {
    console.error("[DocCy] hours check", error);
    return [];
  }
  const rows = (data ?? []) as Array<{
    id: string;
    appointment_datetime: string;
    patient_name: string | null;
    status: string;
    clinic_id: string | null;
  }>;

  return targets.map((clinic) => {
    const location = clinic.location!;
    const visits = rows
      .filter((row) => row.clinic_id === location.clinic_id)
      .map((row) => ({
        id: row.id,
        at: row.appointment_datetime,
        patientName: String(row.patient_name ?? "").trim() || "Patient",
        open: row.status !== "CONFIRMED",
      }));
    const left = visitsLeftOutside(visits, locationWeeklySchedule(location), clinic.week);
    return {
      locationId: clinic.locationId,
      clinicName: String(location.clinic_name ?? "").trim(),
      confirmed: left.filter((visit) => !visit.open).length,
      open: left.filter((visit) => visit.open).length,
      visits: left.slice(0, VISITS_LISTED),
    };
  });
}
