"use client";

import * as React from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { FinderAvailabilityDayHeaderRow } from "@/components/finder/FinderAvailabilityDayHeaderRow";
import {
  FinderAvailabilityDaySlotGrid,
  finderAvailabilitySlotClassName,
} from "@/components/finder/FinderAvailabilityDaySlotGrid";
import { FinderAvailabilityStickyWeekHeader } from "@/components/finder/FinderAvailabilityStickyWeekHeader";
import { useFinderAvailabilityWeek } from "@/components/finder/FinderResultsAvailabilityShell";
import type { PublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";

type Props = {
  calendar: PublicAvailabilityCalendar;
  profileSlug: string;
  anchorStickyWeekNav?: boolean;
};

export function FinderCardAvailabilityGrid({
  calendar,
  profileSlug,
  anchorStickyWeekNav = false,
}: Props) {
  const { windowStart, visibleDayCount, visibleDays } = useFinderAvailabilityWeek();
  const profileHref = `/${profileSlug}`;
  const visibleCalendarDays = calendar.days.slice(windowStart, windowStart + visibleDayCount);
  const headerDays = anchorStickyWeekNav ? visibleDays : visibleCalendarDays;

  if (calendar.days.length === 0) return null;

  return (
    <div data-testid="finder-card-calendar-preview">
      <div className="rounded-lg border border-ink-200 bg-white">
        {anchorStickyWeekNav ? (
          <FinderAvailabilityStickyWeekHeader days={headerDays} />
        ) : (
          <FinderAvailabilityDayHeaderRow days={headerDays} />
        )}
        <FinderAvailabilityDaySlotGrid
          days={visibleCalendarDays}
          resetKey={`${profileSlug}:${windowStart}`}
          renderSlot={(slot, day) => (
            <PendingLink
              href={profileHref}
              navigationReason="profile"
              className={finderAvailabilitySlotClassName}
              title={`Book ${day.weekdayLabel} ${day.dateLabel} at ${slot.timeLabel}`}
            >
              <span className="whitespace-nowrap tabular-nums">{slot.timeLabel}</span>
            </PendingLink>
          )}
        />
      </div>
    </div>
  );
}
