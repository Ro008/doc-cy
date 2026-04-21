"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

const START_EVENT = "doccy:navigation-start";

function isInternalNavigableAnchor(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href") || "";
  if (!href || href.startsWith("#")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    return url.href !== window.location.href;
  } catch {
    return false;
  }
}

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const timerRef = React.useRef<number | null>(null);
  const hideRef = React.useRef<number | null>(null);

  const stopTimers = React.useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hideRef.current) {
      window.clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  }, []);

  const start = React.useCallback(() => {
    setVisible(true);
    setProgress((prev) => (prev > 10 ? prev : 10));
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const delta = prev < 40 ? 10 : prev < 70 ? 6 : 2;
        return Math.min(90, prev + delta);
      });
    }, 180);
  }, []);

  const complete = React.useCallback(() => {
    setProgress(100);
    stopTimers();
    hideRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
  }, [stopTimers]);

  React.useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (!isInternalNavigableAnchor(anchor)) return;
      start();
    };

    const onStartEvent = () => start();

    document.addEventListener("click", onDocClick, true);
    window.addEventListener(START_EVENT, onStartEvent);
    return () => {
      document.removeEventListener("click", onDocClick, true);
      window.removeEventListener(START_EVENT, onStartEvent);
      stopTimers();
    };
  }, [start, stopTimers]);

  React.useEffect(() => {
    if (!visible) return;
    complete();
  }, [pathname, searchParams, visible, complete]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[999] h-[3px] bg-transparent">
      <div
        className="h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

