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
  "min-w-0 flex-1 border-t border-site-ink-100 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0";

/**
 * Every finder card is the same size until the patient opens more times (user,
 * 2026-10-15). The calendar area is one box, whatever it holds: times, a paused
 * clinic, nothing this week, a listing's preview, or the loading skeleton. Its height
 * is the day header (41px, 45px from `lg`) + the collapsed slot grid below + the
 * border.
 */
export const finderCardCalendarBoxClass =
  "flex min-h-[233px] flex-col lg:min-h-[227px] [&>*]:flex-1";

/**
 * The clinic's address on a finder card: always two lines tall (one-line addresses
 * keep the space, longer ones are cut), so the location column is the same height.
 */
export const finderCardAddressClass =
  "line-clamp-2 min-h-[39px] text-xs leading-relaxed text-site-ink-600 break-words";

/**
 * On a phone the identity block sits above the clinic, so it reserves the height of
 * the tallest usual one: a two-line name, two rows of specialties, GeSY and the rating,
 * then the languages.
 */
export const finderCardIdentityMinHeightClass = "min-h-[206px] sm:min-h-0";

/** Fixed skeleton height, the same box. */
export const finderCardCalendarSkeletonHeightClass = "h-[233px] lg:h-[227px]";

/**
 * Collapsed slot grid: 3 times + "+N more" (44px buttons, 40px from `lg`), the same
 * height whether a day has one time or ten.
 */
export const finderCardSlotGridCollapsedClass =
  "h-[190px] overflow-hidden lg:h-[180px] lg:overflow-y-auto";

/** Opened: phones grow with each tap; desktop shows ~6 rows, then scrolls. */
export const finderCardSlotGridExpandedClass = "lg:max-h-[282px] lg:overflow-y-auto";

/** Landing pages are narrower; stack location + calendar until large breakpoints. */
export const finderLandingCardDetailsGridClass =
  "grid items-start gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(300px,1.28fr)]";

/** Grey rule between stacked location + calendar pairs (2+ practice locations). */
export const finderMultiLocationDividerClass = "mt-4 border-t border-site-ink-200 pt-4";

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
  "finder-availability-week-track divide-x divide-site-ink-100";

/**
 * The card as a summary of her profile: the profile's hero, then the clinic's week beside
 * the clinic. Mockup O (user, 2026-10-16): from `lg` the hero is a 300 px panel down the
 * left and the week + clinic sit to its right, so every card has the same shape; a firmer
 * edge and a soft shadow keep each card apart from the next. On a phone and a tablet the
 * panel sits on top and each card fits what it holds.
 */
export const finderProfileCardClass =
  "grid grid-cols-1 gap-4 rounded-[28px] border border-[#D3E2E6] bg-profile-surface p-2 pb-4 shadow-[0_1px_2px_rgba(11,34,54,0.06),0_10px_28px_rgba(11,34,54,0.07)] [.doccy-profile[data-scheme=dark]_&]:border-[#2A4370] [.doccy-profile[data-scheme=dark]_&]:shadow-[0_12px_32px_rgba(0,0,0,0.35)] sm:gap-5 sm:p-2.5 sm:pb-6 lg:min-h-[352px] lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-7 lg:pb-2.5 lg:pr-6";

export const finderProfileCardBodyClass =
  "grid min-w-0 grid-cols-1 items-start gap-x-7 gap-y-4 self-start px-2 lg:self-stretch sm:px-3.5 lg:min-h-[224px] lg:grid-cols-[minmax(0,1fr)_300px] lg:px-0 lg:py-3.5";

/** The week and what is under it: times, the request, or no online booking here. */
export const finderCardTimesAreaClass = "flex min-w-0 flex-col";
