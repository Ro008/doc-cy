/** Rolling window for the manual-card scarcity badge (not calendar month). */
export const FINDER_MANUAL_VOTE_BADGE_WINDOW_DAYS = 60;

export function finderManualVoteBadgeSinceIso(
  now = Date.now(),
): string {
  return new Date(
    now - FINDER_MANUAL_VOTE_BADGE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}
