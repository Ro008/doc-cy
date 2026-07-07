"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { PendingLink } from "@/components/navigation/PendingLink";
import { FinderAvailabilityDayHeaderRow } from "@/components/finder/FinderAvailabilityDayHeaderRow";
import {
  FinderAvailabilityWeekControls,
  useFinderAvailabilityWeek,
} from "@/components/finder/FinderResultsAvailabilityShell";
import {
  FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY,
  type PublicAvailabilityCalendar,
} from "@/lib/public/compute-public-booking-slots";

const STICKY_TOP_PX = 8;

type Props = {
  calendar: PublicAvailabilityCalendar;
  profileSlug: string;
  anchorStickyWeekNav?: boolean;
};

function FinderAvailabilityWeekHeader({
  days,
}: {
  days: Parameters<typeof FinderAvailabilityDayHeaderRow>[0]["days"];
}) {
  return (
    <>
      <FinderAvailabilityWeekControls />
      <FinderAvailabilityDayHeaderRow days={days} />
    </>
  );
}

const anchorHeaderClassName =
  "overflow-hidden rounded-t-lg border-b border-ink-100 bg-ink-50/95 backdrop-blur-sm";

const pinnedHeaderClassName =
  "overflow-hidden rounded-xl border border-clinical-200/80 bg-white/75 shadow-[0_4px_24px_rgba(26,43,60,0.12),0_8px_32px_rgba(11,123,181,0.14)] ring-1 ring-white/60 backdrop-blur-md backdrop-saturate-150";

function FinderAnchorStickyWeekHeader({
  days,
}: {
  days: Parameters<typeof FinderAvailabilityDayHeaderRow>[0]["days"];
}) {
  const headerRef = React.useRef<HTMLDivElement>(null);
  const [isPinned, setIsPinned] = React.useState(false);
  const [pinnedStyle, setPinnedStyle] = React.useState<React.CSSProperties>({});
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const update = () => {
      const rect = header.getBoundingClientRect();
      const pinned = rect.top <= STICKY_TOP_PX;
      setIsPinned(pinned);
      if (pinned) {
        setPinnedStyle({
          top: STICKY_TOP_PX,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, { capture: true });
    };
  }, []);

  const headerContent = <FinderAvailabilityWeekHeader days={days} />;

  return (
    <>
      <div
        ref={headerRef}
        data-finder-sticky-week-anchor
        data-testid="finder-availability-week-nav"
        className={`${anchorHeaderClassName} ${isPinned ? "invisible" : ""}`}
      >
        {headerContent}
      </div>
      {mounted && isPinned
        ? createPortal(
            <div
              data-testid="finder-availability-week-nav-pinned"
              className={`fixed z-[60] ${pinnedHeaderClassName}`}
              style={pinnedStyle}
            >
              {headerContent}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

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
          <FinderAnchorStickyWeekHeader days={headerDays} />
        ) : (
          <FinderAvailabilityDayHeaderRow days={headerDays} />
        )}
        <div
          className="grid divide-x divide-ink-100"
          style={{ gridTemplateColumns: `repeat(${visibleCalendarDays.length}, minmax(0, 1fr))` }}
        >
          {visibleCalendarDays.map((day) => {
            const visibleSlots = day.slots.slice(0, FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY);
            const hasMore = day.slots.length > FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY;

            return (
              <div key={day.dateKey} className="min-w-0">
                <div className="flex min-h-[5.5rem] flex-col gap-1 p-1.5">
                  {visibleSlots.map((slot) => (
                    <PendingLink
                      key={slot.slotKey}
                      href={profileHref}
                      className="inline-flex w-full items-center justify-center rounded-md bg-clinical-500 px-1 py-1 text-[10px] font-semibold leading-none text-white transition hover:bg-clinical-400"
                      title={`Book ${day.weekdayLabel} ${day.dateLabel} at ${slot.timeLabel}`}
                    >
                      <span className="whitespace-nowrap tabular-nums">{slot.timeLabel}</span>
                    </PendingLink>
                  ))}
                  {hasMore ? (
                    <PendingLink
                      href={profileHref}
                      className="inline-flex w-full items-center justify-center py-0.5 text-[10px] font-semibold leading-none text-clinical-600 transition hover:text-clinical-500"
                    >
                      More…
                    </PendingLink>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
