"use client";

import * as React from "react";
import type { ProfileSectionId } from "@/lib/public/profile-sections";

type Props = {
  ariaLabel: string;
  tabs: ReadonlyArray<{ id: ProfileSectionId; label: string }>;
};

/** A section is "current" once its top passes this line under the sticky nav. */
const ACTIVE_LINE_PX = 140;
/** The block that stays on screen on a wide page (the hero with these tabs). */
const PIN_SELECTOR = "[data-profile-pin]";
/** Its height, for the sections' scroll margin (app/globals.css). */
const PIN_HEIGHT_VAR = "--profile-pin-h";

/** The pinned block's bottom edge while it is stuck; null on a phone, where it scrolls away. */
function pinnedBottom(): number | null {
  const pin = document.querySelector(PIN_SELECTOR);
  if (!pin || window.getComputedStyle(pin).position !== "sticky") return null;
  return pin.getBoundingClientRect().bottom;
}
/** Scroll quiet time that ends a tab click's smooth scroll. */
const SCROLL_IDLE_MS = 180;

/**
 * Sticky anchor tabs: every section lives on the same page, the tabs only scroll
 * to it (smooth unless the patient reduces motion) and mark the one being read.
 * On a wide page they sit under the hero and stay on screen with it; on a phone
 * they stick to the top on their own, after the booking column.
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

  // On a wide page the hero stays on screen with the tabs: a tab's section has to stop
  // below it, however tall it is.
  React.useEffect(() => {
    const pin = document.querySelector<HTMLElement>(PIN_SELECTOR);
    const root = pin?.closest<HTMLElement>(".doccy-profile");
    if (!pin || !root) return;
    const update = () => {
      const stuck = window.getComputedStyle(pin).position === "sticky";
      if (stuck) root.style.setProperty(PIN_HEIGHT_VAR, `${Math.round(pin.offsetHeight)}px`);
      else root.style.removeProperty(PIN_HEIGHT_VAR);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(pin);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty(PIN_HEIGHT_VAR);
    };
  }, []);

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
      const pinned = pinnedBottom();
      const line = pinned === null ? ACTIVE_LINE_PX : pinned + 48;
      let current = present[0].id;
      for (const tab of present) {
        const top = document.getElementById(tab.id)!.getBoundingClientRect().top;
        if (top - line <= 0) current = tab.id;
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
      className="profile-glass sticky top-0 z-30 order-3 -mx-4 sm:-mx-6 lg:static lg:mx-0 lg:mt-2 lg:rounded-2xl"
    >
      <ul
        ref={listRef}
        data-overflow-end={overflowEnd ? "true" : "false"}
        className={`flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 lg:px-2 ${
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
