import type { SupabaseClient } from "@supabase/supabase-js";
import type { DoctorAppointmentForBlocking } from "@/lib/appointment-overlap";

export const BLOCKING_APPOINTMENTS_SELECT =
  "id, status, appointment_datetime, duration_minutes, proposed_slots, proposal_expires_at";

/** Statuses that participate in calendar blocking for this doctor. */
export const BLOCKING_APPOINTMENT_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "NEEDS_RESCHEDULE",
] as const;

export type BlockingAppointmentRow = {
  id: string;
  status: string;
  appointment_datetime: string;
  duration_minutes: number | null;
  proposed_slots: unknown;
  proposal_expires_at: string | null;
};

export function toBlockingRows(
  rows: BlockingAppointmentRow[] | null | undefined
): DoctorAppointmentForBlocking[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    appointment_datetime: r.appointment_datetime,
    duration_minutes: r.duration_minutes,
    proposed_slots: r.proposed_slots,
    proposal_expires_at: r.proposal_expires_at,
  }));
}

export async function fetchBlockingAppointments(
  supabase: SupabaseClient,
  doctorId: string
): Promise<{ data: BlockingAppointmentRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("appointments")
    .select(BLOCKING_APPOINTMENTS_SELECT)
    .eq("doctor_id", doctorId)
    .in("status", [...BLOCKING_APPOINTMENT_STATUSES]);

  return {
    data: data as BlockingAppointmentRow[] | null,
    error: error as Error | null,
  };
}
