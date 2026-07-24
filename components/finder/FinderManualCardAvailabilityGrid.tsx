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
  phone?: string | null;
  addressText?: string | null;
  anchorStickyWeekNav?: boolean;
};

export function FinderManualCardAvailabilityGrid({
  manualId,
  doctorName,
  addressMapsLink,
  phone = null,
  addressText = null,
  anchorStickyWeekNav = false,
}: Props) {
  const { dayHeaders, windowStart, visibleDayCount, visibleDays } = useFinderAvailabilityWeek();
  const { pendingSlotKey, submit, modal } = useManualBookingRequestFeedback({
    manualId,
    doctorName,
    addressMapsLink,
    phone,
    addressText,
  });

  const previewCalendar = React.useMemo(
    () => buildManualPreviewCalendar(dayHeaders, manualId),
    [dayHeaders, manualId],
  );

  const visibleCalendarDays = previewCalendar.slice(windowStart, windowStart + visibleDayCount);
  const headerDays = anchorStickyWeekNav ? visibleDays : visibleCalendarDays;
  const isSubmitting = pendingSlotKey !== null;

  if (previewCalendar.length === 0) return null;

  return (
    <>
      <div
        data-testid="finder-card-calendar-preview"
        aria-busy={isSubmitting}
        aria-live="polite"
      >
        <div className="rounded-lg border border-ink-200 bg-white">
          {anchorStickyWeekNav ? (
            <FinderAvailabilityStickyWeekHeader days={headerDays} />
          ) : (
            <FinderAvailabilityDayHeaderRow days={headerDays} />
          )}
          <FinderAvailabilityDaySlotGrid
            days={visibleCalendarDays}
            resetKey={`${manualId}:${windowStart}`}
            renderSlot={(slot, day) => {
              const isActiveSlot = pendingSlotKey === slot.slotKey;

              return (
                <button
                  type="button"
                  disabled={isSubmitting}
                  aria-busy={isActiveSlot}
                  onClick={() => submit(slot.slotKey)}
                  className={`relative inline-flex w-full items-center justify-center rounded-md bg-clinical-500 px-1 py-1 text-[10px] font-semibold leading-none text-white transition hover:bg-clinical-400 disabled:cursor-wait disabled:hover:bg-clinical-500 ${
                    isSubmitting && !isActiveSlot ? "opacity-45" : ""
                  } ${isActiveSlot ? "opacity-100" : "motion-safe:animate-pulse"}`}
                  title={`Request online booking for ${day.weekdayLabel} ${day.dateLabel} at ${slot.timeLabel}`}
                >
                  <span
                    className={`whitespace-nowrap tabular-nums ${
                      isActiveSlot ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    {slot.timeLabel}
                  </span>
                  {isActiveSlot ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span
                        aria-hidden
                        className="h-3 w-3 animate-spin rounded-full border border-white border-r-transparent"
                      />
                    </span>
                  ) : null}
                </button>
              );
            }}
          />
        </div>
      </div>
      {modal}
    </>
  );
}
