import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_PATIENT_CANCEL_NOTICE_HOURS,
  PATIENT_CANCEL_NOTICE_CHOICES,
} from "@/lib/patient-cancel-window";

/**
 * Until how many hours before a visit its patient can cancel online (user, 2026-10-11):
 * - the deadline the visit was confirmed with (`appointments.patient_cancel_notice_hours`,
 *   copied from the clinic at confirmation), so a later change in Settings never moves
 *   a deadline the patient was already told;
 * - for a visit confirmed before deadlines were kept, the clinic's current one;
 * - 12 hours when neither is known.
 */

function choice(value: unknown): number | null {
  return typeof value === "number" && (PATIENT_CANCEL_NOTICE_CHOICES as readonly number[]).includes(value)
    ? value
    : null;
}

export function visitCancelNoticeHours(
  visit: { patient_cancel_notice_hours?: number | null; clinic_id?: string | null },
  clinics: readonly { clinicId?: string | null; cancelNoticeHours?: number | null }[],
): number {
  const clinic = visit.clinic_id ? clinics.find((row) => row.clinicId === visit.clinic_id) : undefined;
  return (
    choice(visit.patient_cancel_notice_hours) ??
    choice(clinic?.cancelNoticeHours) ??
    DEFAULT_PATIENT_CANCEL_NOTICE_HOURS
  );
}

/** The same rule on the server, for the patient's cancel page and the emails. */
export async function loadVisitCancelNoticeHours(service: SupabaseClient, appointmentId: string): Promise<number> {
  const { data: visit } = await service
    .from("appointments")
    .select("professional_id, clinic_id, patient_cancel_notice_hours")
    .eq("id", appointmentId)
    .maybeSingle();
  const row = visit as {
    professional_id?: string | null;
    clinic_id?: string | null;
    patient_cancel_notice_hours?: number | null;
  } | null;
  const kept = choice(row?.patient_cancel_notice_hours);
  if (kept !== null) return kept;
  if (!row?.professional_id || !row.clinic_id) return DEFAULT_PATIENT_CANCEL_NOTICE_HOURS;

  const { data: link } = await service
    .from("professional_clinics")
    .select("patient_cancel_notice_hours")
    .eq("professional_id", row.professional_id)
    .eq("clinic_id", row.clinic_id)
    .maybeSingle();
  return (
    choice((link as { patient_cancel_notice_hours?: number | null } | null)?.patient_cancel_notice_hours) ??
    DEFAULT_PATIENT_CANCEL_NOTICE_HOURS
  );
}
