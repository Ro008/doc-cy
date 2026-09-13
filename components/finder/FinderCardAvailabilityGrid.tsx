"use client";

import * as React from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { FinderAvailabilityDayHeaderRow } from "@/components/finder/FinderAvailabilityDayHeaderRow";
import { FinderAvailabilityDaySlotGrid } from "@/components/finder/FinderAvailabilityDaySlotGrid";
import { finderAvailabilitySlotClassName } from "@/components/finder/finder-availability-layout";
import {
  FinderAvailabilityWeekControls,
  useFinderAvailabilityWeek,
} from "@/components/finder/FinderResultsAvailabilityShell";
import { buildDoctorBookingHref } from "@/lib/booking-slot-param";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import type { PublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";
import { computeFinderCardAvailabilityWeekState } from "@/lib/public/finder-availability-week-window";

type Props = {
  calendar: PublicAvailabilityCalendar;
  profileSlug: string;
  locationId?: string | null;
};

export function FinderCardAvailabilityGrid({
  calendar,
  profileSlug,
  locationId = null,
}: Props) {
  const { windowStart, visibleDayCount, goToWeekContainingDayIndex } = useFinderAvailabilityWeek();
  const weekState = computeFinderCardAvailabilityWeekState(calendar.days, windowStart, visibleDayCount);

  if (weekState.kind === "no-availability-in-window") {
    return (
      <div data-testid="finder-card-calendar-preview">
        <div className="overflow-hidden rounded-lg border border-ink-200 bg-white p-3 text-center">
          <PendingLink
            href={publicProfessionalProfilePath(profileSlug)}
            navigationReason="profile"
            className="text-xs font-semibold text-clinical-700 underline-offset-2 hover:underline"
          >
            View full availability
          </PendingLink>
        </div>
      </div>
    );
  }

  const visibleCalendarDays = calendar.days.slice(windowStart, windowStart + visibleDayCount);

  return (
    <div data-testid="finder-card-calendar-preview">
      <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
        <FinderAvailabilityWeekControls />
        <FinderAvailabilityDayHeaderRow days={visibleCalendarDays} />
        {weekState.kind === "no-slots-this-week" ? (
          <FinderCardNoSlotsThisWeek
            nextAvailableDayIndex={weekState.nextAvailableDayIndex}
            nextAvailableDateLabel={weekState.nextAvailableDateLabel}
            onGoToNextAvailableWeek={goToWeekContainingDayIndex}
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}

function FinderCardNoSlotsThisWeek({
  nextAvailableDayIndex,
  nextAvailableDateLabel,
  onGoToNextAvailableWeek,
}: {
  nextAvailableDayIndex: number | null;
  nextAvailableDateLabel: string | null;
  onGoToNextAvailableWeek: (dayIndex: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-4 text-center">
      <p className="text-xs font-medium text-ink-500">No availabilities this week</p>
      {nextAvailableDayIndex !== null ? (
        <button
          type="button"
          onClick={() => onGoToNextAvailableWeek(nextAvailableDayIndex)}
          className="text-xs font-semibold text-clinical-700 underline-offset-2 hover:underline"
        >
          Next slots available {nextAvailableDateLabel}
        </button>
      ) : null}
    </div>
  );
}
