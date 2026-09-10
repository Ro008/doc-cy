/**
 * @deprecated Lifetime badge — no date window. Kept so old imports still resolve.
 * Prefer counting all professional_patient_booking_requests rows for a listing.
 */
export const FINDER_MANUAL_VOTE_BADGE_WINDOW_DAYS = null;

/** @deprecated Lifetime badge — callers should omit created_at filters. */
export function finderManualVoteBadgeSinceIso(_now = Date.now()): null {
  return null;
}
