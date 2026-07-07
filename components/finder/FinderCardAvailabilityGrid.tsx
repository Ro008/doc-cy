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

  React.useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let frame = 0;
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

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true, capture: true });
    window.addEventListener("resize", scheduleUpdate);
    document.addEventListener("scroll", scheduleUpdate, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate, { capture: true });
      window.removeEventListener("resize", scheduleUpdate);
      document.removeEventListener("scroll", scheduleUpdate, { capture: true });
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
      {isPinned && typeof document !== "undefined"
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
  const [expandedDays, setExpandedDays] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setExpandedDays(new Set());
  }, [calendar.days.length, profileSlug, windowStart]);

  if (calendar.days.length === 0) return null;

  function toggleDayExpanded(dateKey: string) {
    setExpandedDays((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }

  return (
    <div data-testid="finder-card-calendar-preview">
      <div className="rounded-lg border border-ink-200 bg-white">
        {anchorStickyWeekNav ? (
          <FinderAnchorStickyWeekHeader days={headerDays} />
        ) : (
          <FinderAvailabilityDayHeaderRow days={headerDays} />
        )}
        <div
          className="grid items-stretch divide-x divide-ink-100"
          style={{ gridTemplateColumns: `repeat(${visibleCalendarDays.length}, minmax(0, 1fr))` }}
        >
          {visibleCalendarDays.map((day) => {
            const isExpanded = expandedDays.has(day.dateKey);
            const previewSlots = day.slots.slice(0, FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY);
            const extraSlots = day.slots.slice(FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY);
            const hasMore = extraSlots.length > 0;

            return (
              <div key={day.dateKey} className="flex min-w-0 flex-col">
                <div className="flex min-h-[5.5rem] flex-1 flex-col gap-1 p-1.5">
                  {previewSlots.map((slot) => (
                    <PendingLink
                      key={slot.slotKey}
                      href={profileHref}
                      navigationReason="profile"
                      className="inline-flex w-full items-center justify-center rounded-md bg-clinical-500 px-1 py-1 text-[10px] font-semibold leading-none text-white transition hover:bg-clinical-400"
                      title={`Book ${day.weekdayLabel} ${day.dateLabel} at ${slot.timeLabel}`}
                    >
                      <span className="whitespace-nowrap tabular-nums">{slot.timeLabel}</span>
                    </PendingLink>
                  ))}
                  {hasMore ? (
                    <>
                      <div
                        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div
                            className={`flex flex-col gap-1 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
                              isExpanded ? "opacity-100" : "pointer-events-none opacity-0"
                            }`}
                          >
                            {extraSlots.map((slot) => (
                              <PendingLink
                                key={slot.slotKey}
                                href={profileHref}
                                navigationReason="profile"
                                className="inline-flex w-full items-center justify-center rounded-md bg-clinical-500 px-1 py-1 text-[10px] font-semibold leading-none text-white transition hover:bg-clinical-400"
                                title={`Book ${day.weekdayLabel} ${day.dateLabel} at ${slot.timeLabel}`}
                              >
                                <span className="whitespace-nowrap tabular-nums">{slot.timeLabel}</span>
                              </PendingLink>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded
                            ? `Show fewer times for ${day.weekdayLabel} ${day.dateLabel}`
                            : `Show all available times for ${day.weekdayLabel} ${day.dateLabel}`
                        }
                        onClick={() => toggleDayExpanded(day.dateKey)}
                        className="inline-flex w-full items-center justify-center py-0.5 text-[10px] font-semibold leading-none text-clinical-600 transition-colors duration-200 ease-out hover:text-clinical-500"
                      >
                        {isExpanded ? "Less…" : "More…"}
                      </button>
                    </>
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
