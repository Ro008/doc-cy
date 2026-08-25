"use client";

import * as React from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { FinderAvailabilityDayHeaderRow } from "@/components/finder/FinderAvailabilityDayHeaderRow";
import { FinderAvailabilityDaySlotGrid } from "@/components/finder/FinderAvailabilityDaySlotGrid";
import { FinderAvailabilityStickyWeekHeader } from "@/components/finder/FinderAvailabilityStickyWeekHeader";
import { finderAvailabilitySlotClassName } from "@/components/finder/finder-availability-layout";
import { useFinderAvailabilityWeek } from "@/components/finder/FinderResultsAvailabilityShell";
import { buildDoctorBookingHref } from "@/lib/booking-slot-param";
import type { PublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";

type Props = {
  calendar: PublicAvailabilityCalendar;
  profileSlug: string;
  locationId?: string | null;
  anchorStickyWeekNav?: boolean;
};

export function FinderCardAvailabilityGrid({
  calendar,
  profileSlug,
  locationId = null,
  anchorStickyWeekNav = false,
}: Props) {
  const { windowStart, visibleDayCount } = useFinderAvailabilityWeek();
  const visibleCalendarDays = calendar.days.slice(windowStart, windowStart + visibleDayCount);

  if (calendar.days.length === 0) return null;

  return (
    <div data-testid="finder-card-calendar-preview">
      <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
        {anchorStickyWeekNav ? (
          <FinderAvailabilityStickyWeekHeader />
        ) : (
          <FinderAvailabilityDayHeaderRow days={visibleCalendarDays} />
        )}
        <FinderAvailabilityDaySlotGrid
          days={visibleCalendarDays}
          resetKey={`${profileSlug}:${locationId ?? "primary"}:${windowStart}`}
          renderSlot={(slot, day) => (
            <PendingLink
              href={buildDoctorBookingHref(profileSlug, slot.slotKey, locationId)}
              navigationReason="profile"
              className={finderAvailabilitySlotClassName}
              aria-label={`Book ${day.weekdayLabel} ${day.dateLabel} at ${slot.timeLabel}`}
            >
              <span className="whitespace-nowrap tabular-nums">{slot.timeLabel}</span>
            </PendingLink>
          )}
        />
      </div>
    </div>
  );
}
