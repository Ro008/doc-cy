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
  children: React.ReactNode;
};

function FinderAvailabilityWeekProvider({ dayHeaders, children }: ProviderProps) {
  const visibleDayCount = FINDER_AVAILABILITY_VISIBLE_DAY_COUNT;
  const weekStep = FINDER_AVAILABILITY_VISIBLE_DAY_COUNT;
  const maxWindowStart = Math.max(0, dayHeaders.length - visibleDayCount);
  const [windowStart, setWindowStart] = React.useState(0);
  const [direction, setDirection] = React.useState<"forward" | "backward">("forward");
  const [expandedSlot, setExpandedSlot] = React.useState<FinderExpandedSlot | null>(null);

  React.useEffect(() => {
    setWindowStart((current) => Math.min(current, maxWindowStart));
  }, [maxWindowStart, dayHeaders.length]);

  const value = React.useMemo<FinderAvailabilityWeekContextValue>(() => {
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
        setDirection("backward");
        setWindowStart((current) => Math.max(0, current - weekStep));
      },
      goToNextWeek: () => {
        setDirection("forward");
        setWindowStart((current) => Math.min(maxWindowStart, current + weekStep));
      },
      goToWeekContainingDayIndex: (dayIndex: number) => {
        const target = snapWindowStartToDayIndex(dayIndex, weekStep, maxWindowStart);
        setDirection((current) => {
          if (target === windowStart) return current;
          return target > windowStart ? "forward" : "backward";
        });
        setWindowStart(target);
      },
      expandedSlot,
      setExpandedSlot,
    };
  }, [dayHeaders, direction, expandedSlot, maxWindowStart, visibleDayCount, weekStep, windowStart]);

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
      className={`flex w-9 shrink-0 items-center justify-center self-stretch bg-ink-50 text-ink-500 transition hover:bg-clinical-100 hover:text-clinical-700 disabled:cursor-not-allowed disabled:opacity-30 ${
        isPrev ? "border-r" : "border-l"
      } border-ink-100`}
    >
      {isPrev ? <ChevronLeft className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
    </button>
  );
}

export function FinderAvailabilityWeekControls() {
  const { canGoPrevious, canGoNext, goToPreviousWeek, goToNextWeek } =
    useFinderAvailabilityWeek();

  return (
    <div className="flex items-center justify-between border-b border-ink-100 bg-white px-1 py-0.5">
      <button
        type="button"
        aria-label="Show previous days"
        disabled={!canGoPrevious}
        onClick={goToPreviousWeek}
        className="flex h-11 w-11 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-50 hover:text-clinical-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Show next days"
        disabled={!canGoNext}
        onClick={goToNextWeek}
        className="flex h-11 w-11 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-50 hover:text-clinical-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

type ShellProps = {
  dayHeaders: FinderAvailabilityDayHeader[];
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

export function FinderResultsAvailabilityShell({ dayHeaders, children }: ShellProps) {
  if (dayHeaders.length === 0) {
    return <>{children}</>;
  }

  return (
    <FinderAvailabilityWeekProvider dayHeaders={dayHeaders}>
      <FinderAvailabilityWeekSurface>{children}</FinderAvailabilityWeekSurface>
    </FinderAvailabilityWeekProvider>
  );
}
