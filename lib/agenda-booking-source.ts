/**
 * `appointments.booking_source`: how a visit got into the agenda. The agenda marks manual
 * bookings (phone or walk-in) so she can tell them from online ones (user, 2026-10-07).
 */
export type AgendaBookingSource = "online" | "manual";

export const MANUAL_BOOKING_LABEL = "Manual booking";

export function isManualBooking(source: string | null | undefined): boolean {
  return String(source ?? "").trim().toLowerCase() === "manual";
}

/** Realtime payloads are untyped: keep only the two known values. */
export function agendaBookingSourceFromRaw(raw: unknown): AgendaBookingSource | null {
  return raw === "online" || raw === "manual" ? raw : null;
}
