"use client";

import * as React from "react";
import { FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY } from "@/lib/public/compute-public-booking-slots";
import { useFinderAvailabilityWeek } from "@/components/finder/FinderResultsAvailabilityShell";

export type FinderAvailabilityDaySlots = {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
  slots: { slotKey: string; timeLabel: string }[];
};

type Props = {
  days: FinderAvailabilityDaySlots[];
  resetKey: string;
  renderSlot: (
    slot: { slotKey: string; timeLabel: string },
    day: FinderAvailabilityDaySlots,
  ) => React.ReactNode;
};

/** Matches the app's `lg` breakpoint — the same one the card's own two-column layout switches on. */
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
/**
 * Both heights land exactly on a whole lg slot-button row (40px + 6px gap) so the last visible row is
 * never half-cut. Collapsed = 3 slots + the "+N more" badge (its natural height); expanded = 6 whole
 * slots, ~1.5x the collapsed height, capped and scrollable past that.
 */
const DESKTOP_COLLAPSED_HEIGHT_PX = 180;
const DESKTOP_EXPANDED_HEIGHT_PX = 282;
/** Mobile/tablet never scrolls — each tap reveals a few more slots instead, so the card just grows. */
const INCREMENTAL_REVEAL_STEP = 5;

function useIsDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    setIsDesktop(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

export function FinderAvailabilityDaySlotGrid({ days, resetKey, renderSlot }: Props) {
  const { expandedSlot, setExpandedSlot } = useFinderAvailabilityWeek();
  const isDesktop = useIsDesktopViewport();

  function revealMore(day: FinderAvailabilityDaySlots) {
    const slotId = `${resetKey}:${day.dateKey}`;
    const currentCount =
      expandedSlot?.id === slotId ? expandedSlot.revealedCount : FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY;
    const nextCount = isDesktop
      ? day.slots.length
      : Math.min(currentCount + INCREMENTAL_REVEAL_STEP, day.slots.length);
    setExpandedSlot({ id: slotId, revealedCount: nextCount });
  }

  const isThisCardExpanded = days.some((day) => expandedSlot?.id === `${resetKey}:${day.dateKey}`);

  return (
    <div
      className={
        isDesktop
          ? "overflow-y-auto transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none"
          : undefined
      }
      style={
        isDesktop
          ? { maxHeight: isThisCardExpanded ? DESKTOP_EXPANDED_HEIGHT_PX : DESKTOP_COLLAPSED_HEIGHT_PX }
          : undefined
      }
    >
      <div
        className="grid items-stretch gap-x-2 divide-x divide-ink-100"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const slotId = `${resetKey}:${day.dateKey}`;
          const revealedCount =
            expandedSlot?.id === slotId ? expandedSlot.revealedCount : FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY;
          const visibleSlots = day.slots.slice(0, revealedCount);
          const extraCount = day.slots.length - visibleSlots.length;

          return (
            <div key={day.dateKey} className="flex min-h-[5.5rem] min-w-0 flex-col">
              <div className="flex flex-col gap-1.5 px-1 py-1.5">
                {visibleSlots.length === 0 ? (
                  <p className="pt-1 text-center text-[10px] font-medium text-ink-400">No slots</p>
                ) : null}
                {visibleSlots.map((slot) => (
                  <React.Fragment key={slot.slotKey}>{renderSlot(slot, day)}</React.Fragment>
                ))}
                {extraCount > 0 ? (
                  <button
                    type="button"
                    aria-label={`Show ${extraCount} more times for ${day.weekdayLabel} ${day.dateLabel}`}
                    onClick={() => revealMore(day)}
                    className="inline-flex w-full min-h-[1.75rem] items-center justify-center rounded-md border border-clinical-200 bg-clinical-50 py-1 text-[10px] font-semibold leading-none tabular-nums text-clinical-700 transition-colors duration-200 ease-out hover:bg-clinical-100"
                  >
                    {`+${extraCount} more`}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
