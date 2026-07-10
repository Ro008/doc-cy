"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getNavigationStartMessage,
  NAVIGATION_START_EVENT,
  type NavigationStartDetail,
} from "@/lib/doccy-navigation";

type FinderResultsTransitionProps = {
  children: React.ReactNode;
};

export function FinderResultsTransition({ children }: FinderResultsTransitionProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [transitionMessage, setTransitionMessage] = React.useState(
    getNavigationStartMessage("finder-results"),
  );
  const transitionStartedAtRef = React.useRef<number>(0);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    function onStart(event: Event) {
      const reason =
        (event as CustomEvent<NavigationStartDetail>).detail?.reason ?? "default";
      setTransitionMessage(getNavigationStartMessage(reason));
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      transitionStartedAtRef.current = Date.now();
      setIsTransitioning(true);
    }
    window.addEventListener(NAVIGATION_START_EVENT, onStart);
    return () => window.removeEventListener(NAVIGATION_START_EVENT, onStart);
  }, []);

  React.useEffect(() => {
    if (!isTransitioning) return;
    const elapsed = Date.now() - transitionStartedAtRef.current;
    const minVisibleMs = 300;
    if (elapsed >= minVisibleMs) {
      setIsTransitioning(false);
      return;
    }
    clearTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
      clearTimerRef.current = null;
    }, minVisibleMs - elapsed);
  }, [pathname, searchParams]);

  React.useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div
        aria-busy={isTransitioning}
        className={`transition-opacity duration-200 ease-out ${
          isTransitioning ? "pointer-events-none opacity-60 blur-[2px]" : "opacity-100"
        }`}
      >
        {children}
      </div>
      <div
        aria-live="polite"
        className={`pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center transition-all duration-200 ${
          isTransitioning && transitionMessage !== getNavigationStartMessage("finder-near-me")
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-1"
        }`}
      >
        <div className="inline-flex items-center gap-2 text-sm font-medium text-ink-600">
          <span
            aria-hidden
            className="h-3.5 w-3.5 animate-spin rounded-full border border-clinical-400 border-r-transparent"
          />
          <span>{transitionMessage}</span>
        </div>
      </div>
    </div>
  );
}
