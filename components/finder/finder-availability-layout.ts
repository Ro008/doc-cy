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
 * G's card (Finder G, step 4; user, 2026-10-16): who (photo, name, specialties, GeSY,
 * rating, languages) beside where (clinic, address, Maps, phones), then the calendar area
 * across the whole card. One column on a phone.
 */
export const finderGCardGridClass =
  "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";

/**
 * The calendar area under G's card top: one fixed size whatever it holds (the day circles
 * with times, a paused clinic, a listing's request box, the loading skeleton), so every
 * card is the same size (user, 2026-10-15).
 */
export const finderCardCalendarAreaClass =
  "flex h-[222px] flex-col border-t border-site-ink-100 pt-3.5 sm:col-span-2";

/**
 * G's identity cell: photo, name, specialties, GeSY · rating · languages. It keeps the
 * height of the usual tallest one (one-line name from `sm`, two lines of specialties, the
 * facts line), so the calendar area starts at the same height on every card.
 */
export const finderGCardIdentityClass = "min-h-[140px] sm:min-h-[104px]";

export const finderGCardPhotoClass =
  "h-14 w-14 shrink-0 overflow-hidden rounded-full bg-site-clinical-100 transition-none";

export const finderGCardNameClass =
  "text-left text-lg font-extrabold leading-tight text-site-ink-900 transition-none hover:text-site-clinical-700";
