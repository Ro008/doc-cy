/**
 * A next-availability row in the profile hero asks BookingSection to open that
 * day, and the details form for that time when it carries one, without
 * reloading the page. The row is a plain `#book` anchor, so without JavaScript
 * it still scrolls to the calendar.
 */

export const PROFILE_SELECT_DAY_EVENT = "doccy:profile-select-day";

export type ProfileDaySelectDetail = { dateKey: string; slotKey?: string | null };

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_KEY_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function parseProfileDaySelectDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const dateKey = (detail as { dateKey?: unknown }).dateKey;
  return typeof dateKey === "string" && DATE_KEY_RE.test(dateKey) ? dateKey : null;
}

/** The time to open the details form for: only a well-formed time on that same day. */
export function parseProfileSlotSelectDetail(detail: unknown): string | null {
  const dateKey = parseProfileDaySelectDetail(detail);
  if (!dateKey) return null;
  const slotKey = (detail as { slotKey?: unknown }).slotKey;
  if (typeof slotKey !== "string" || !SLOT_KEY_RE.test(slotKey)) return null;
  return slotKey.startsWith(`${dateKey}T`) ? slotKey : null;
}

export function requestProfileDaySelect(dateKey: string, slotKey: string | null = null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ProfileDaySelectDetail>(PROFILE_SELECT_DAY_EVENT, { detail: { dateKey, slotKey } }),
  );
}
