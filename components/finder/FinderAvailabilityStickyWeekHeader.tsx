"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { FinderAvailabilityDayHeaderRow } from "@/components/finder/FinderAvailabilityDayHeaderRow";
import {
  FinderAvailabilityWeekControls,
} from "@/components/finder/FinderResultsAvailabilityShell";

const STICKY_TOP_PX = 8;

const anchorHeaderClassName =
  "overflow-hidden rounded-t-lg border-b border-ink-100 bg-ink-50/95 backdrop-blur-sm";

const pinnedHeaderClassName =
  "overflow-hidden rounded-xl border border-clinical-200/80 bg-white/75 shadow-[0_4px_24px_rgba(26,43,60,0.12),0_8px_32px_rgba(11,123,181,0.14)] ring-1 ring-white/60 backdrop-blur-md backdrop-saturate-150";

type DayHeader = Parameters<typeof FinderAvailabilityDayHeaderRow>[0]["days"];

function FinderAvailabilityWeekHeader({ days }: { days: DayHeader }) {
  return (
    <>
      <FinderAvailabilityWeekControls />
      <FinderAvailabilityDayHeaderRow days={days} />
    </>
  );
}

export function FinderAvailabilityStickyWeekHeader({ days }: { days: DayHeader }) {
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
