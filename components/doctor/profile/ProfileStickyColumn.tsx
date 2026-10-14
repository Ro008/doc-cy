"use client";

import * as React from "react";

type Props = {
  id: string;
  ariaLabel: string;
  testId: string;
  className: string;
  children: React.ReactNode;
};

/** Its height, for the sticky offset below. */
const HEIGHT_VAR = "--profile-book-h";
/** Space under the column when it is pinned by its bottom (1rem, as in its class). */
const BOTTOM_GAP_PX = 16;

/**
 * The booking column on a wide page (user, 2026-10-14): it stays on screen while her
 * sections scroll. When it fits, it pins at the top; when it is taller than the screen,
 * it scrolls with the page until its bottom edge (Continue) is in view and pins there,
 * so the times and Continue never leave the screen; scrolling back up brings its top back.
 * No scrollbar of its own. The class gives the bottom pin before the script runs.
 */
export function ProfileStickyColumn({ id, ariaLabel, testId, className, children }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const column = ref.current;
    if (!column) return;
    const update = () => column.style.setProperty(HEIGHT_VAR, `${Math.ceil(column.offsetHeight)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(column);

    // A column taller than the screen moves with the scroll between its two pinned spots:
    // scrolling down it pins by its bottom, scrolling up it slides back down until its top
    // (the clinic rows) is in view. Without this it would come back only at the page top.
    let top = 0;
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (window.getComputedStyle(column).position !== "sticky") {
        column.style.removeProperty("top");
        lastScrollY = y;
        return;
      }
      const lowest = Math.min(0, window.innerHeight - column.offsetHeight - BOTTOM_GAP_PX);
      top = Math.min(0, Math.max(lowest, top - (y - lastScrollY)));
      lastScrollY = y;
      column.style.top = `${top}px`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      role="region"
      aria-label={ariaLabel}
      data-testid={testId}
      className={`${className} lg:sticky lg:top-[min(0px,calc(100vh_-_var(--profile-book-h,0px)_-_1rem))] lg:self-start lg:pt-3`}
    >
      {children}
    </div>
  );
}
