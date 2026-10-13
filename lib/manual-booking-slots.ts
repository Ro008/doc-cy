import {
  candidateOverlapsAnyBlockingInterval,
  type DoctorAppointmentForBlocking,
} from "@/lib/appointment-overlap";

export type ManualBookingAppointmentRow = {
  id: string;
  appointment_datetime: string;
  status?: string | null;
  duration_minutes?: number | null;
  proposed_slots?: unknown;
  proposal_expires_at?: string | null;
};

/**
 * Whether a manual booking starting at `slotStartIso` would clash with the professional's
 * agenda. A professional is one person: a visit in any clinic blocks the time in all of them
 * (clinics only decide where and which hours). Same interval rules as the booking API
 * (duration overlap; counter-offers hold only their live proposed times).
 */
export function isManualBookingSlotTaken(
  slotStartIso: string,
  durationMinutes: number,
  appointments: readonly ManualBookingAppointmentRow[],
  nowMs: number = Date.now(),
): boolean {
  const rows: DoctorAppointmentForBlocking[] = appointments.map((a) => ({
    id: a.id,
    status: String(a.status ?? ""),
    appointment_datetime: a.appointment_datetime,
    duration_minutes: a.duration_minutes,
    proposed_slots: a.proposed_slots,
    proposal_expires_at: a.proposal_expires_at ?? null,
  }));
  return candidateOverlapsAnyBlockingInterval(
    slotStartIso,
    durationMinutes,
    null,
    rows,
    durationMinutes,
    nowMs,
  );
}

/**
 * The page's appointments plus the ones this modal has just booked (or just been told are
 * taken), so a time is hidden straight away instead of after the page refreshes. A booking
 * the page already has is not counted twice.
 */
export function withJustBooked(
  fromPage: readonly ManualBookingAppointmentRow[],
  justBooked: readonly ManualBookingAppointmentRow[],
): ManualBookingAppointmentRow[] {
  const known = new Set(fromPage.map((a) => a.id));
  return [...fromPage, ...justBooked.filter((a) => !known.has(a.id))];
}
