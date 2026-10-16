"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFinderAvailabilityWeek } from "@/components/finder/FinderResultsAvailabilityShell";
import { finderDayStripCircles, finderDayStripLongDate } from "@/lib/finder-card-day-strip";
import type { PublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";

// The profile's calendar look (user, 2026-10-16): its nav buttons and day colours, from the
// same profile colours (the Finder sits in SiteSchemeRoot, light and dark).
const arrowClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-profile-border bg-profile-surface text-profile-text transition-none hover:opacity-80 disabled:cursor-default disabled:text-profile-off disabled:hover:opacity-100 sm:h-9 sm:w-9";

/**
 * The card's week (mockup L): seven days, today first, filled where this clinic has free
 * times. The chosen day and the arrows are shared by every card. Without `days` (a listing,
 * or no online booking at this clinic) every day is grey and only the arrows move.
 */
export function FinderCardWeek({ days }: { days: PublicAvailabilityCalendar["days"] | null }) {
  const { dayHeaders, windowStart, canGoPrevious, canGoNext, goToPreviousWeek, goToNextWeek, selectedDayIndex, selectDay } =
    useFinderAvailabilityWeek();
  const bookable = days !== null;
  const circles = finderDayStripCircles(dayHeaders, days ?? [], windowStart);

  return (
    <div className="flex max-w-[470px] items-end gap-1.5" data-testid="finder-card-week">
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
          const on = bookable && circle.index === selectedDayIndex;
          const has = bookable && circle.hasTimes;
          const today = circle.label === "TODAY";
          const className = `inline-flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums transition-none sm:h-10 sm:w-10 ${
            on
              ? "bg-accent-cta font-extrabold text-accent-on-cta"
              : has
                ? "bg-accent-soft font-extrabold text-profile-text hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-accent"
                : "text-profile-off"
          } ${today && !on ? "underline underline-offset-[3px]" : ""}`;
          return (
            <div key={circle.dateKey} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-profile-muted sm:text-[13px]">{circle.label}</span>
              {bookable ? (
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${finderDayStripLongDate(circle.dateKey)}${circle.hasTimes ? "" : ", no times"}`}
                  onClick={() => selectDay(circle.index)}
                  className={className}
                >
                  {circle.dayNumber}
                </button>
              ) : (
                <span className={className} aria-label={`${finderDayStripLongDate(circle.dateKey)}, no online booking`}>
                  {circle.dayNumber}
                </span>
              )}
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
  );
}
