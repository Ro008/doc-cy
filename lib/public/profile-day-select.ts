/**
 * A next-availability day card in the profile hero asks BookingSection to open
 * that day, without reloading the page. The card is a plain `#book` anchor, so
 * without JavaScript it still scrolls to the calendar.
 */

export const PROFILE_SELECT_DAY_EVENT = "doccy:profile-select-day";

export type ProfileDaySelectDetail = { dateKey: string };

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseProfileDaySelectDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const dateKey = (detail as { dateKey?: unknown }).dateKey;
  return typeof dateKey === "string" && DATE_KEY_RE.test(dateKey) ? dateKey : null;
}

export function requestProfileDaySelect(dateKey: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ProfileDaySelectDetail>(PROFILE_SELECT_DAY_EVENT, { detail: { dateKey } }),
  );
}
