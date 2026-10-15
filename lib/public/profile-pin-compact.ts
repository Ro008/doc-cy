/** The hero shrinks once the page has scrolled past this, and grows back near the top. */
export const COMPACT_AFTER_PX = 24;
export const EXPAND_BELOW_PX = 4;

/**
 * Whether the pinned hero on a wide profile page is shrunk (only her photo, name and
 * specialties). Two thresholds, so the height change can't flicker.
 *
 * It shrinks only when the page has room to stay scrolled afterwards: shrinking takes at most
 * the hero's own height, so the page needs more scroll room than that plus the threshold. On a
 * profile only a little taller than the screen, shrinking made the page fit, the scroll went
 * back to the top and the hero grew again: the end of the page could never be reached
 * (2026-10-15). There is nothing to save on such a page, so the hero stays whole.
 *
 * `room` is how far the page can scroll now (scrollHeight - innerHeight); `pinHeight` the
 * hero's height now.
 */
export function nextPinCompact(input: {
  stuck: boolean;
  y: number;
  wasCompact: boolean;
  room: number;
  pinHeight: number;
}): boolean {
  const { stuck, y, wasCompact, room, pinHeight } = input;
  if (!stuck || y < EXPAND_BELOW_PX) return false;
  if (wasCompact) return true;
  return y > COMPACT_AFTER_PX && room > pinHeight + COMPACT_AFTER_PX;
}
