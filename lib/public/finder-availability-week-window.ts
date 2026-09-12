/** Minimal day shape so this stays a dependency-free, easily unit-testable leaf module. */
type FinderCalendarDayLike = {
  slots: readonly unknown[];
  dateLabel: string;
};

export type FinderCardAvailabilityWeekState =
  | { kind: "no-availability-in-window" }
  | { kind: "has-slots" }
  | {
      kind: "no-slots-this-week";
      nextAvailableDayIndex: number | null;
      nextAvailableDateLabel: string | null;
    };

/**
 * Decides what a single finder card should show for the currently-visible
 * week: the real slot grid, a "no availability anywhere in the window"
 * empty state, or a "nothing this week, but here's the next open day" one.
 * `days` is the doctor's full calendar (already bounded to their own
 * booking horizon), `windowStart`/`visibleDayCount` describe the shared
 * week currently in view.
 */
export function computeFinderCardAvailabilityWeekState(
  days: readonly FinderCalendarDayLike[],
  windowStart: number,
  visibleDayCount: number,
): FinderCardAvailabilityWeekState {
  const hasAnySlotInWindow = days.some((day) => day.slots.length > 0);
  if (!hasAnySlotInWindow) {
    return { kind: "no-availability-in-window" };
  }

  const visibleDays = days.slice(windowStart, windowStart + visibleDayCount);
  const hasSlotsThisWeek = visibleDays.some((day) => day.slots.length > 0);
  if (hasSlotsThisWeek) {
    return { kind: "has-slots" };
  }

  const nextAvailableDayIndex = days.findIndex(
    (day, index) => index >= windowStart && day.slots.length > 0,
  );
  return {
    kind: "no-slots-this-week",
    nextAvailableDayIndex: nextAvailableDayIndex === -1 ? null : nextAvailableDayIndex,
    nextAvailableDateLabel:
      nextAvailableDayIndex === -1 ? null : days[nextAvailableDayIndex]!.dateLabel,
  };
}

/** Snaps a day index to the start of the 5-day "page" that contains it. */
export function snapWindowStartToDayIndex(
  dayIndex: number,
  weekStep: number,
  maxWindowStart: number,
): number {
  const snapped = Math.floor(Math.max(0, dayIndex) / weekStep) * weekStep;
  return Math.min(maxWindowStart, snapped);
}
