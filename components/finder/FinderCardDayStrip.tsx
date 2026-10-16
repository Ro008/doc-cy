"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { finderCardCalendarAreaClass } from "@/components/finder/finder-availability-layout";
import { useFinderAvailabilityWeek } from "@/components/finder/FinderResultsAvailabilityShell";
import { buildDoctorBookingHref } from "@/lib/booking-slot-param";
import {
  finderDayStripCircles,
  finderDayStripLongDate,
  finderDayStripShortDate,
  finderDayStripState,
  finderDayStripTimeGrid,
} from "@/lib/finder-card-day-strip";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import type { PublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";


// The profile's calendar look (user, 2026-10-16): its nav buttons, day colours and time buttons,
// from the same profile colours (the Finder sits in SiteSchemeRoot, light and dark).
const arrowClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-profile-border bg-profile-surface text-profile-text transition-none hover:opacity-80 disabled:cursor-default disabled:text-profile-off disabled:hover:opacity-100 sm:h-9 sm:w-9";

const timeClass =
  "inline-flex min-h-12 items-center justify-center rounded-2xl border-2 border-accent-soft bg-profile-surface px-1 text-base font-bold tabular-nums text-profile-text transition-none hover:border-accent";

const softButtonClass =
  "inline-flex min-h-[40px] items-center rounded-2xl border-2 border-accent-soft bg-profile-surface px-3 text-sm font-bold text-accent-link transition-none hover:border-accent";

/**
 * G's day circles on a registered card (Finder G, step 4; user, 2026-10-16): seven days,
 * today first, filled where this clinic has free times. The chosen day and the arrows are
 * shared with every card; below, that day's times link straight to booking.
 */
export function FinderCardDayStrip({
  calendar,
  profileSlug,
  locationId = null,
}: {
  calendar: PublicAvailabilityCalendar;
  profileSlug: string;
  locationId?: string | null;
}) {
  const { dayHeaders, windowStart, canGoPrevious, canGoNext, goToPreviousWeek, goToNextWeek, selectedDayIndex, selectDay } =
    useFinderAvailabilityWeek();
  const circles = finderDayStripCircles(dayHeaders, calendar.days, windowStart);
  const state = finderDayStripState(calendar.days, selectedDayIndex);
  const selectedHeader = dayHeaders[selectedDayIndex];
  const profileHref = publicProfessionalProfilePath(profileSlug);
  const grid = finderDayStripTimeGrid(state.kind === "times" ? state.slots.length : 0);

  return (
    <div data-testid="finder-card-day-strip" className={finderCardCalendarAreaClass}>
      <div className="flex max-w-[480px] items-end gap-1 sm:gap-1.5">
        <button
          type="button"
          aria-label="Earlier days, every card"
          disabled={!canGoPrevious}
          onClick={goToPreviousWeek}
          className={arrowClass}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
          {circles.map((circle) => {
            const on = circle.index === selectedDayIndex;
            return (
              <div key={circle.dateKey} className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-profile-muted sm:text-[13px]">
                  {circle.label}
                </span>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${finderDayStripLongDate(circle.dateKey)}${circle.hasTimes ? "" : ", no times"}`}
                  onClick={() => selectDay(circle.index)}
                  className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-full text-sm tabular-nums transition-none sm:h-10 sm:w-10 ${
                    on
                      ? "bg-accent-cta font-extrabold text-accent-on-cta"
                      : circle.hasTimes
                        ? "bg-accent-soft font-extrabold text-profile-text hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-accent"
                        : "text-profile-off"
                  } ${circle.label === "TODAY" && !on ? "underline underline-offset-[3px]" : ""}`}
                >
                  {circle.dayNumber}
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Later days, every card"
          disabled={!canGoNext}
          onClick={goToNextWeek}
          className={arrowClass}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-2.5 max-w-[480px]">
        {selectedHeader ? (
          <p className="text-base font-bold text-profile-text">{finderDayStripLongDate(selectedHeader.dateKey)}</p>
        ) : null}
        {state.kind === "times" ? (
          // Two rows on the left of the card; when the times no longer fit, the last cell is All times.
          <div className="mt-1.5 grid grid-cols-4 gap-1.5 sm:grid-cols-5" data-testid="finder-card-times">
            {state.slots.slice(0, grid.rendered).map((slot, index) => (
              <PendingLink
                key={slot.slotKey}
                href={buildDoctorBookingHref(profileSlug, slot.slotKey, locationId)}
                navigationReason="profile"
                aria-label={`Book ${selectedHeader ? finderDayStripLongDate(selectedHeader.dateKey) : ""} at ${slot.timeLabel}`}
                className={`${timeClass} ${index >= grid.phone.times ? "max-sm:hidden" : ""} ${
                  index >= grid.wide.times ? "sm:hidden" : ""
                }`}
              >
                {slot.timeLabel}
              </PendingLink>
            ))}
            {grid.phone.allTimes || grid.wide.allTimes ? (
              <PendingLink
                href={profileHref}
                navigationReason="profile"
                className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-1 text-sm font-bold text-accent-link hover:underline ${
                  grid.phone.allTimes ? "" : "max-sm:hidden"
                } ${grid.wide.allTimes ? "" : "sm:hidden"}`}
              >
                All times
              </PendingLink>
            ) : null}
          </div>
        ) : state.kind === "none-this-day" ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-profile-muted">No times this day.</span>
            <button
              type="button"
              onClick={() => selectDay(state.nextFreeIndex)}
              className={softButtonClass}
            >
              Next free: {finderDayStripShortDate(calendar.days[state.nextFreeIndex]!.dateKey)}
            </button>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-profile-muted">No free times online in the coming weeks.</span>
            <PendingLink href={profileHref} navigationReason="profile" className={softButtonClass}>
              View profile
            </PendingLink>
          </div>
        )}
      </div>
    </div>
  );
}
