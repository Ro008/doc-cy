/** Shared layout tokens so sticky week nav aligns with card availability grids. */
export const finderRegisteredCardDetailsGridClass =
  "grid items-start gap-5 sm:grid-cols-[minmax(0,0.72fr)_minmax(300px,1.28fr)]";

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

export const finderAvailabilitySlotClassName =
  "inline-flex w-full items-center justify-center rounded-md bg-clinical-500 px-1 py-1 text-[10px] font-semibold leading-none text-white hover:bg-clinical-400";

/** Sliding 14-day strip; `--finder-week-start` is set by FinderResultsAvailabilityShell. */
export const finderAvailabilityWeekTrackClassName =
  "finder-availability-week-track divide-x divide-ink-100";
