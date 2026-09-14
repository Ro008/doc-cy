/** Shared layout tokens so sticky week nav aligns with card availability grids. */
/**
 * Two columns only from `lg`: the calendar's 300px floor leaves the location
 * column ~30px on a tablet beside the identity column, which breaks addresses
 * mid-word. Below `lg` location and calendar stack at full width.
 */
export const finderRegisteredCardDetailsGridClass =
  "grid items-start gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(300px,1.28fr)]";

export const finderRegisteredIdentityColumnClass = "sm:w-[260px] lg:w-[300px]";

/** `items-start` so expanding slots grow the card instead of stretching the identity column. */
export const finderRegisteredCardRowClass =
  "flex h-auto w-full flex-col gap-4 overflow-visible sm:flex-row sm:items-start sm:gap-5";

export const finderRegisteredDetailsSectionClass =
  "min-w-0 flex-1 border-t border-ink-100 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0";

/** Landing pages are narrower; stack location + calendar until large breakpoints. */
export const finderLandingCardDetailsGridClass =
  "grid items-start gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(300px,1.28fr)]";

/** Grey rule between stacked location + calendar pairs (2+ practice locations). */
export const finderMultiLocationDividerClass = "mt-4 border-t border-ink-200 pt-4";

export const FINDER_LOCATION_CALENDAR_DIVIDER_TEST_ID =
  "finder-location-calendar-divider";

export function finderMultiLocationRowClass(index: number): string | undefined {
  return index > 0 ? finderMultiLocationDividerClass : undefined;
}

/**
 * min-h keeps each slot a ~44px touch target (Apple HIG minimum) on phones/tablets, where mis-taps are
 * costly; desktop (mouse, not touch) can afford a slightly shorter, denser button from `lg` up.
 * Font size is responsive too: the 5-day grid's columns are narrow enough on phones/tablets that the
 * larger desktop size clips mid-digit ("14:30" -> "14:3") — stay compact until `lg` where columns widen.
 * bg opacity keeps the brand teal but softens it from a solid block; hover goes full-strength as an interactive cue.
 */
export const finderAvailabilitySlotClassName =
  "inline-flex w-full min-h-[2.75rem] lg:min-h-[2.5rem] items-center justify-center rounded-md bg-clinical-500/80 px-0.5 py-1.5 text-[10px] lg:text-sm font-bold leading-none text-white hover:bg-clinical-400";

/** Sliding 90-day strip, paged 5 days at a time starting from today; `--finder-week-start` is set by FinderResultsAvailabilityShell. */
export const finderAvailabilityWeekTrackClassName =
  "finder-availability-week-track divide-x divide-ink-100";
