import { finderBookingRequestWindowSinceIso } from "@/lib/finder-booking-request-stats";

/** @deprecated Use FINDER_BOOKING_REQUEST_WINDOW_DAYS — kept for existing imports. */
export const FINDER_MANUAL_VOTE_BADGE_WINDOW_DAYS = 30;

export function finderManualVoteBadgeSinceIso(now = Date.now()): string {
  return finderBookingRequestWindowSinceIso(now);
}
