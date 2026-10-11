/**
 * A service's own "Book" button in "Services & prices" asks the booking form (BookingSection) to
 * pick that service, without reloading the page (2026-10-11). The button is a plain `#book`
 * anchor, so without JavaScript it still jumps to the calendar.
 * (Which step the booking is on is shared through ProfileBookingStep, not an event.)
 */

export const PROFILE_SELECT_SERVICE_EVENT = "doccy:profile-select-service";

export function parseProfileServiceSelectDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const serviceId = (detail as { serviceId?: unknown }).serviceId;
  return typeof serviceId === "string" && serviceId.trim() ? serviceId.trim() : null;
}

export function requestProfileServiceSelect(serviceId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROFILE_SELECT_SERVICE_EVENT, { detail: { serviceId } }));
}
