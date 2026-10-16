"use client";

import { PendingLink } from "@/components/navigation/PendingLink";
import { finderCardTimesAreaClass } from "@/components/finder/finder-availability-layout";
import { FinderCardWeek } from "@/components/finder/FinderCardWeek";
import { useFinderAvailabilityWeek } from "@/components/finder/FinderResultsAvailabilityShell";
import { buildDoctorBookingHref } from "@/lib/booking-slot-param";
import {
  finderDayStripLongDate,
  finderDayStripShortDate,
  finderDayStripState,
  finderDayStripTimeGrid,
} from "@/lib/finder-card-day-strip";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import type { PublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";

// The profile's time buttons, a size smaller so three rows fit beside the clinic (mockup L).
const timeClass =
  "inline-flex min-h-[34px] items-center justify-center rounded-xl border-2 border-accent-soft bg-profile-surface px-1 text-sm font-bold tabular-nums text-profile-text transition-none hover:border-accent";

const softButtonClass =
  "inline-flex min-h-9 items-center rounded-xl border-2 border-accent-soft bg-profile-surface px-3 text-sm font-bold text-accent-link transition-none hover:border-accent";

/**
 * The week of a clinic that takes online bookings (mockup L; user, 2026-10-16), then the
 * chosen day's times, which link straight to booking: three rows, 6 a row from sm and 4 on
 * a phone; when they no longer fit, the last cell is All times (her profile until the
 * profile pop-up of step 5). Holiday mode needs nothing of its own: Next free skips it.
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
  const { dayHeaders, selectedDayIndex, selectDay } = useFinderAvailabilityWeek();
  const state = finderDayStripState(calendar.days, selectedDayIndex);
  const selectedHeader = dayHeaders[selectedDayIndex];
  const profileHref = publicProfessionalProfilePath(profileSlug);
  const grid = finderDayStripTimeGrid(state.kind === "times" ? state.slots.length : 0);

  return (
    <section aria-label="Times" data-testid="finder-card-day-strip" className={finderCardTimesAreaClass}>
      <FinderCardWeek days={calendar.days} />

      <div className="max-w-[470px]">
        {selectedHeader ? (
          <p className="mb-2 mt-3.5 text-base font-bold text-profile-text">
            {finderDayStripLongDate(selectedHeader.dateKey)}
          </p>
        ) : null}
        {state.kind === "times" ? (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" data-testid="finder-card-times">
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
                className={`inline-flex min-h-[34px] items-center justify-center rounded-xl px-1 text-[13px] font-bold text-accent-link hover:underline ${
                  grid.phone.allTimes ? "" : "max-sm:hidden"
                } ${grid.wide.allTimes ? "" : "sm:hidden"}`}
              >
                All times
              </PendingLink>
            ) : null}
          </div>
        ) : state.kind === "none-this-day" ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm text-profile-muted">No times this day.</span>
            <button type="button" onClick={() => selectDay(state.nextFreeIndex)} className={softButtonClass}>
              Next free: {finderDayStripShortDate(calendar.days[state.nextFreeIndex]!.dateKey)}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm text-profile-muted">No free times online in the coming weeks.</span>
            <PendingLink href={profileHref} navigationReason="profile" className={softButtonClass}>
              View profile
            </PendingLink>
          </div>
        )}
      </div>
    </section>
  );
}
