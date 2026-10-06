/**
 * The public booking calendar recomputes which times it offers this often, so a time that
 * slips inside the minimum notice while the page is open disappears instead of being refused.
 */
export const BOOKING_SLOT_REFRESH_MS = 60_000;

/** Keys under BookingPage.errors in messages/*.json. */
export type BookingRefusalKey =
  | "slotTooSoon"
  | "slotNoLongerAvailable"
  | "timeSlotJustBooked"
  | "openRequestExists";

export type BookingRefusal = { messageKey: BookingRefusalKey; backToCalendar: boolean };

/** Schedule refusals (lib/schedule-slot-check.ts) meaning "this time is not offered any more". */
const NO_LONGER_OFFERED = new Set(["outside_hours", "not_aligned", "beyond_horizon", "holiday"]);

/**
 * What the patient sees when POST /api/appointments refuses the request, instead of the
 * server's technical message. `null`: show the server's message as before.
 */
export function bookingRefusal(status: number, code: string | null | undefined): BookingRefusal | null {
  if (code === "open_request_exists") return { messageKey: "openRequestExists", backToCalendar: false };
  if (status === 409 || code === "slot_taken") return { messageKey: "timeSlotJustBooked", backToCalendar: true };
  if (code === "minimum_notice") return { messageKey: "slotTooSoon", backToCalendar: true };
  if (code && NO_LONGER_OFFERED.has(code)) return { messageKey: "slotNoLongerAvailable", backToCalendar: true };
  return null;
}
