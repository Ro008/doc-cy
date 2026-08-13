/** Shared layout tokens so sticky week nav aligns with card availability grids. */
export const finderRegisteredCardDetailsGridClass =
  "grid gap-5 sm:grid-cols-[minmax(0,0.72fr)_minmax(300px,1.28fr)]";

export const finderRegisteredIdentityColumnClass = "sm:w-[260px] lg:w-[300px]";

export const finderRegisteredCardRowClass =
  "flex w-full flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5";

export const finderRegisteredDetailsSectionClass =
  "min-w-0 flex-1 border-t border-ink-100 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0";

/** Landing pages are narrower; stack location + calendar until large breakpoints. */
export const finderLandingCardDetailsGridClass =
  "grid gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(300px,1.28fr)]";

export const finderAvailabilitySlotClassName =
  "inline-flex w-full items-center justify-center rounded-md bg-clinical-500 px-1 py-1 text-[10px] font-semibold leading-none text-white hover:bg-clinical-400";

/** Sliding 14-day strip; `--finder-week-start` is set by FinderResultsAvailabilityShell. */
export const finderAvailabilityWeekTrackClassName =
  "finder-availability-week-track divide-x divide-ink-100";
