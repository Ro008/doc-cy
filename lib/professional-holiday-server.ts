import type { SupabaseClient } from "@supabase/supabase-js";

import { holidayRangeUtc, type HolidayVisitCounts } from "@/lib/holiday-mode";
import type { HttpResult } from "@/lib/profile-change-requests-server";

/**
 * Holiday mode on the server (user, 2026-10-11): the database function saves the dates
 * and their record together (professional_holiday_set), and refuses a start in the past
 * or an end before the start.
 */

type Saved = HttpResult<{ changed: boolean }>;

/** `changed` is false when she saved the holiday she already had, which records nothing. */
export async function saveHoliday(
  service: SupabaseClient,
  input: { professionalId: string; enabled: boolean; startDate: string | null; endDate: string | null },
): Promise<Saved> {
  const { data, error } = await service.rpc("professional_holiday_set", {
    p_professional_id: input.professionalId,
    p_enabled: input.enabled,
    p_start_date: input.enabled ? input.startDate : null,
    p_end_date: input.enabled ? input.endDate : null,
  });
  if (error) {
    // 22023 refused dates, 22007 / 22008 a date that cannot be read.
    if (["22023", "22007", "22008"].includes(String(error.code))) {
      return {
        ok: false,
        status: 400,
        message: "Check the holiday dates: it cannot start in the past or end before it starts.",
      };
    }
    console.error("[DocCy] holiday mode", error);
    return { ok: false, status: 500, message: "Could not save holiday mode. Please try again." };
  }
  return { ok: true, changed: Boolean(data) };
}

export type HolidayVisit = {
  id: string;
  /** Start of the visit (ISO). */
  at: string;
  patientName: string;
  clinicName: string;
  /** A request still waiting for her answer (not a confirmed visit). */
  open: boolean;
};

const VISITS_LISTED = 20;

/**
 * Confirmed visits and open requests still to come inside the holiday's dates, for the
 * warning before saving. Nothing is cancelled: she decides what to do with each.
 */
export async function loadHolidayVisits(
  service: SupabaseClient,
  input: { professionalId: string; start: string; end: string; now?: Date },
): Promise<HolidayVisitCounts & { visits: HolidayVisit[] }> {
  const range = holidayRangeUtc(input.start, input.end);
  const nowIso = (input.now ?? new Date()).toISOString();
  const { data, error } = await service
    .from("appointments")
    .select("id, appointment_datetime, patient_name, status, clinic_id")
    .eq("professional_id", input.professionalId)
    .in("status", ["CONFIRMED", "REQUESTED", "NEEDS_RESCHEDULE"])
    .gte("appointment_datetime", range.from > nowIso ? range.from : nowIso)
    .lt("appointment_datetime", range.to)
    .order("appointment_datetime", { ascending: true });
  if (error) {
    console.error("[DocCy] holiday visits", error);
    return { confirmed: 0, open: 0, visits: [] };
  }
  const rows = (data ?? []) as Array<{
    id: string;
    appointment_datetime: string;
    patient_name: string | null;
    status: string;
    clinic_id: string | null;
  }>;
  const clinicIds = Array.from(new Set(rows.map((row) => row.clinic_id).filter(Boolean))) as string[];
  const clinicNames = new Map<string, string>();
  if (clinicIds.length > 0) {
    const { data: clinics } = await service.from("clinics").select("id, name").in("id", clinicIds);
    for (const clinic of (clinics ?? []) as Array<{ id: string; name: string | null }>) {
      clinicNames.set(clinic.id, String(clinic.name ?? "").trim());
    }
  }
  const visits = rows.map((row) => ({
    id: row.id,
    at: row.appointment_datetime,
    patientName: String(row.patient_name ?? "").trim() || "Patient",
    clinicName: clinicNames.get(String(row.clinic_id ?? "")) ?? "",
    open: row.status !== "CONFIRMED",
  }));
  return {
    confirmed: visits.filter((visit) => !visit.open).length,
    open: visits.filter((visit) => visit.open).length,
    visits: visits.slice(0, VISITS_LISTED),
  };
}
