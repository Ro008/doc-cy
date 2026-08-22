"use client";

import * as React from "react";
import { FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY } from "@/lib/public/compute-public-booking-slots";

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

export function FinderAvailabilityDaySlotGrid({ days, resetKey, renderSlot }: Props) {
  const [expandedDays, setExpandedDays] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setExpandedDays(new Set());
  }, [resetKey]);

  function toggleDayExpanded(dateKey: string) {
    setExpandedDays((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }

  return (
    <div
      className="grid items-stretch divide-x divide-ink-100"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
    >
      {days.map((day) => {
        const isExpanded = expandedDays.has(day.dateKey);
        const previewSlots = day.slots.slice(0, FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY);
        const extraSlots = day.slots.slice(FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY);
        const hasMore = extraSlots.length > 0;

        return (
          <div key={day.dateKey} className="flex min-h-[5.5rem] min-w-0 flex-col">
            <div className="flex flex-col gap-1 p-1.5">
              {previewSlots.map((slot) => (
                <React.Fragment key={slot.slotKey}>{renderSlot(slot, day)}</React.Fragment>
              ))}
              {hasMore ? (
                <>
                  <div
                    className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
                      isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div
                        className={`flex flex-col gap-1 pt-1 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
                          isExpanded ? "opacity-100" : "pointer-events-none opacity-0"
                        }`}
                      >
                        {extraSlots.map((slot) => (
                          <React.Fragment key={slot.slotKey}>
                            {renderSlot(slot, day)}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded
                        ? `Show fewer times for ${day.weekdayLabel} ${day.dateLabel}`
                        : `Show all available times for ${day.weekdayLabel} ${day.dateLabel}`
                    }
                    onClick={() => toggleDayExpanded(day.dateKey)}
                    className="inline-flex w-full items-center justify-center py-0.5 text-[10px] font-semibold leading-none text-clinical-600 transition-colors duration-200 ease-out hover:text-clinical-500"
                  >
                    {isExpanded ? "Less…" : "More…"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
