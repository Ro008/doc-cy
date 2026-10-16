"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useManualBookingRequestFeedback } from "@/components/finder/useManualBookingRequestFeedback";
import {
  FINDER_MANUAL_CALENDAR_ATTR,
  FINDER_MANUAL_REQUEST_ATTR,
  parseFinderManualRequestClick,
} from "@/lib/finder-manual-slot-click";
import {
  FINDER_AVAILABILITY_VISIBLE_DAY_COUNT,
  type FinderAvailabilityDayHeader,
} from "@/lib/public/compute-public-booking-slots";
import { snapWindowStartToDayIndex } from "@/lib/public/finder-availability-week-window";

export type FinderExpandedSlot = { id: string; revealedCount: number };

type FinderAvailabilityWeekContextValue = {
  dayHeaders: FinderAvailabilityDayHeader[];
  windowStart: number;
  visibleDayCount: number;
  visibleDays: FinderAvailabilityDayHeader[];
  /** Which way the window last moved — drives the page-in animation direction. */
  direction: "forward" | "backward";
  canGoPrevious: boolean;
  canGoNext: boolean;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToWeekContainingDayIndex: (dayIndex: number) => void;
  /**
   * G's day circles (Finder G, step 4): the day every card shows, as an index in
   * `dayHeaders` (0 = today). The arrows choose the first day of the new week.
   */
  selectedDayIndex: number;
  /** Chooses a day on every card and moves to its week. */
  selectDay: (dayIndex: number) => void;
  /** Page-wide: only one day, on one card, can be expanded past its default slot count at a time. */
  expandedSlot: FinderExpandedSlot | null;
  setExpandedSlot: (next: FinderExpandedSlot | null) => void;
};

const FinderAvailabilityWeekContext = React.createContext<FinderAvailabilityWeekContextValue | null>(
  null,
);

export function useFinderAvailabilityWeek(): FinderAvailabilityWeekContextValue {
  const value = React.useContext(FinderAvailabilityWeekContext);
  if (!value) {
    throw new Error("useFinderAvailabilityWeek must be used within FinderResultsAvailabilityShell");
  }
  return value;
}

type ProviderProps = {
  dayHeaders: FinderAvailabilityDayHeader[];
  /** Days a week shows: 7 for the Finder's day circles, 5 for the listing page's grid. */
  dayCount: number;
  children: React.ReactNode;
};

function FinderAvailabilityWeekProvider({ dayHeaders, dayCount, children }: ProviderProps) {
  const visibleDayCount = dayCount;
  const weekStep = dayCount;
  const maxWindowStart = Math.max(0, dayHeaders.length - visibleDayCount);
  const [windowStart, setWindowStart] = React.useState(0);
  const [direction, setDirection] = React.useState<"forward" | "backward">("forward");
  const [expandedSlot, setExpandedSlot] = React.useState<FinderExpandedSlot | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = React.useState(0);

  React.useEffect(() => {
    setWindowStart((current) => Math.min(current, maxWindowStart));
  }, [maxWindowStart, dayHeaders.length]);

  const value = React.useMemo<FinderAvailabilityWeekContextValue>(() => {
    const goToWeekContainingDayIndex = (dayIndex: number) => {
      const target = snapWindowStartToDayIndex(dayIndex, weekStep, maxWindowStart);
      setDirection((current) => {
        if (target === windowStart) return current;
        return target > windowStart ? "forward" : "backward";
      });
      setWindowStart(target);
    };
    const visibleDays = dayHeaders.slice(windowStart, windowStart + visibleDayCount);
    return {
      dayHeaders,
      windowStart,
      visibleDayCount,
      visibleDays,
      direction,
      canGoPrevious: windowStart > 0,
      canGoNext: windowStart < maxWindowStart,
      goToPreviousWeek: () => {
        const next = Math.max(0, windowStart - weekStep);
        setDirection("backward");
        setWindowStart(next);
        setSelectedDayIndex(next);
      },
      goToNextWeek: () => {
        const next = Math.min(maxWindowStart, windowStart + weekStep);
        setDirection("forward");
        setWindowStart(next);
        setSelectedDayIndex(next);
      },
      goToWeekContainingDayIndex,
      selectedDayIndex,
      selectDay: (dayIndex: number) => {
        setSelectedDayIndex(dayIndex);
        goToWeekContainingDayIndex(dayIndex);
      },
      expandedSlot,
      setExpandedSlot,
    };
  }, [dayHeaders, direction, expandedSlot, maxWindowStart, selectedDayIndex, visibleDayCount, weekStep, windowStart]);

  return (
    <FinderAvailabilityWeekContext.Provider value={value}>
      {children}
    </FinderAvailabilityWeekContext.Provider>
  );
}

/** A single day-paging arrow, sized to sit flush beside the day-header row instead of its own bar. */
export function FinderAvailabilityDayArrowButton({ direction }: { direction: "prev" | "next" }) {
  const { canGoPrevious, canGoNext, goToPreviousWeek, goToNextWeek } = useFinderAvailabilityWeek();
  const isPrev = direction === "prev";

  return (
    <button
      type="button"
      aria-label={isPrev ? "Show previous days" : "Show next days"}
      disabled={isPrev ? !canGoPrevious : !canGoNext}
      onClick={isPrev ? goToPreviousWeek : goToNextWeek}
      className={`flex w-9 shrink-0 items-center justify-center self-stretch bg-site-ink-50 text-site-ink-500 transition hover:bg-site-clinical-100 hover:text-site-clinical-700 disabled:cursor-not-allowed disabled:opacity-30 ${
        isPrev ? "border-r" : "border-l"
      } border-site-ink-100`}
    >
      {isPrev ? <ChevronLeft className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
    </button>
  );
}

type ShellProps = {
  dayHeaders: FinderAvailabilityDayHeader[];
  /** Days a week shows; the listing page keeps its 5-day grid. */
  dayCount?: number;
  children: React.ReactNode;
};

function FinderAvailabilityWeekSurface({ children }: { children: React.ReactNode }) {
  const { windowStart, visibleDayCount, dayHeaders } = useFinderAvailabilityWeek();
  const { submit, pendingManualId } = useManualBookingRequestFeedback();
  const isSubmitting = pendingManualId !== null;

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (isSubmitting) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const requestEl = target.closest(`[${FINDER_MANUAL_REQUEST_ATTR}]`);
    if (!(requestEl instanceof HTMLElement)) return;
    const calendar = requestEl.closest(`[${FINDER_MANUAL_CALENDAR_ATTR}]`);
    if (!(calendar instanceof HTMLElement)) return;
    const parsed = parseFinderManualRequestClick({
      manualId: calendar.dataset.manualId ?? "",
      clinicId: calendar.dataset.clinicId ?? "",
      source: calendar.dataset.requestSource ?? "",
    });
    if (!parsed) return;
    event.preventDefault();
    void submit(parsed.manualId, {
      clinicId: parsed.clinicId,
      source: parsed.source,
    });
  }

  return (
    <div
      data-finder-manual-booking-surface
      aria-busy={isSubmitting || undefined}
      onClick={handleClick}
      style={
        {
          "--finder-week-start": String(windowStart),
          "--finder-day-count": String(dayHeaders.length),
          "--finder-visible-days": String(visibleDayCount),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function FinderResultsAvailabilityShell({
  dayHeaders,
  dayCount = FINDER_AVAILABILITY_VISIBLE_DAY_COUNT,
  children,
}: ShellProps) {
  if (dayHeaders.length === 0) {
    return <>{children}</>;
  }

  return (
    <FinderAvailabilityWeekProvider dayHeaders={dayHeaders} dayCount={dayCount}>
      <FinderAvailabilityWeekSurface>{children}</FinderAvailabilityWeekSurface>
    </FinderAvailabilityWeekProvider>
  );
}
