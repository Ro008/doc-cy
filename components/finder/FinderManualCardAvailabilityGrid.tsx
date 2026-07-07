"use client";

import * as React from "react";
import { FinderAvailabilityDayHeaderRow } from "@/components/finder/FinderAvailabilityDayHeaderRow";
import {
  FinderAvailabilityDaySlotGrid,
  finderAvailabilitySlotClassName,
} from "@/components/finder/FinderAvailabilityDaySlotGrid";
import { FinderAvailabilityStickyWeekHeader } from "@/components/finder/FinderAvailabilityStickyWeekHeader";
import { useFinderAvailabilityWeek } from "@/components/finder/FinderResultsAvailabilityShell";
import { useManualBookingRequestFeedback } from "@/components/finder/useManualBookingRequestFeedback";
import { buildManualPreviewCalendar } from "@/lib/finder-manual-preview-calendar";

type Props = {
  manualId: string;
  doctorName: string;
  addressMapsLink: string;
  anchorStickyWeekNav?: boolean;
};

export function FinderManualCardAvailabilityGrid({
  manualId,
  doctorName,
  addressMapsLink,
  anchorStickyWeekNav = false,
}: Props) {
  const { dayHeaders, windowStart, visibleDayCount, visibleDays } = useFinderAvailabilityWeek();
  const { pending, submit, modal } = useManualBookingRequestFeedback({
    manualId,
    doctorName,
    addressMapsLink,
  });

  const previewCalendar = React.useMemo(
    () => buildManualPreviewCalendar(dayHeaders, manualId),
    [dayHeaders, manualId],
  );

  const visibleCalendarDays = previewCalendar.slice(windowStart, windowStart + visibleDayCount);
  const headerDays = anchorStickyWeekNav ? visibleDays : visibleCalendarDays;

  if (previewCalendar.length === 0) return null;

  return (
    <>
      <div data-testid="finder-card-calendar-preview">
        <div className="rounded-lg border border-ink-200 bg-white">
          {anchorStickyWeekNav ? (
            <FinderAvailabilityStickyWeekHeader days={headerDays} />
          ) : (
            <FinderAvailabilityDayHeaderRow days={headerDays} />
          )}
          <FinderAvailabilityDaySlotGrid
            days={visibleCalendarDays}
            resetKey={`${manualId}:${windowStart}`}
            renderSlot={(slot, day) => (
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className={`${finderAvailabilitySlotClassName} disabled:cursor-wait disabled:opacity-70`}
                title={`Book ${day.weekdayLabel} ${day.dateLabel} at ${slot.timeLabel}`}
              >
                <span className="whitespace-nowrap tabular-nums">{slot.timeLabel}</span>
              </button>
            )}
          />
        </div>
      </div>
      {modal}
    </>
  );
}
