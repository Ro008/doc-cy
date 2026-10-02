"use client";

import * as React from "react";
import type { ProfileSectionId } from "@/lib/public/profile-sections";

type Props = {
  ariaLabel: string;
  tabs: ReadonlyArray<{ id: ProfileSectionId; label: string }>;
};

/** A section is "current" once its top passes this line under the sticky nav. */
const ACTIVE_LINE_PX = 140;
/** Scroll quiet time that ends a tab click's smooth scroll. */
const SCROLL_IDLE_MS = 180;

/**
 * Sticky anchor tabs: every section lives on the same page, the tabs only scroll
 * to it (smooth unless the patient reduces motion) and mark the one being read.
 */
export function ProfileSectionNav({ ariaLabel, tabs }: Props) {
  const [active, setActive] = React.useState<ProfileSectionId>(tabs[0]?.id ?? "book");
  // While a clicked tab's scroll runs, keep that tab marked instead of every
  // section it passes; released when scrolling goes quiet.
  const clickLockRef = React.useRef(false);
  // On small screens the tabs scroll sideways; fade the edge while more sit off to the right.
  const listRef = React.useRef<HTMLUListElement>(null);
  const [overflowEnd, setOverflowEnd] = React.useState(false);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () =>
      setOverflowEnd(list.scrollWidth - list.clientWidth - list.scrollLeft > 4);
    update();
    list.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [tabs]);
  const idleTimerRef = React.useRef<number | undefined>(undefined);

  const releaseLockWhenIdle = React.useCallback((delay: number) => {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      clickLockRef.current = false;
    }, delay);
  }, []);

  React.useEffect(() => {
    let frame = 0;
    const compute = () => {
      const present = tabs.filter((tab) => document.getElementById(tab.id));
      if (present.length === 0) return;
      const root = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= root.scrollHeight - 4;
      if (atBottom) {
        setActive(present[present.length - 1].id);
        return;
      }
      let current = present[0].id;
      for (const tab of present) {
        const top = document.getElementById(tab.id)!.getBoundingClientRect().top;
        if (top - ACTIVE_LINE_PX <= 0) current = tab.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (clickLockRef.current) {
        releaseLockWhenIdle(SCROLL_IDLE_MS);
        return;
      }
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(idleTimerRef.current);
    };
  }, [tabs, releaseLockWhenIdle]);

  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-0 z-30 border-b border-profile-border bg-profile-bg"
    >
      <ul
        ref={listRef}
        data-overflow-end={overflowEnd ? "true" : "false"}
        className={`mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 lg:px-8 ${
          overflowEnd
            ? "[mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)]"
            : ""
        }`}
      >
        {tabs.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id} className="shrink-0">
              <a
                href={`#${tab.id}`}
                onClick={() => {
                  clickLockRef.current = true;
                  // Released by the scroll it starts, or now if already there.
                  releaseLockWhenIdle(SCROLL_IDLE_MS * 3);
                  setActive(tab.id);
                }}
                aria-current={current ? "location" : undefined}
                className={`relative inline-flex min-h-[52px] items-center px-3 text-[15px] font-bold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:origin-center after:rounded-full after:bg-accent after:transition-transform after:duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                  current
                    ? "text-profile-text after:scale-x-100"
                    : "text-profile-muted after:scale-x-0 hover:text-profile-text"
                }`}
              >
                {tab.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
