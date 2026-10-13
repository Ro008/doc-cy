"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribePendingRequestsCount } from "@/lib/pending-requests-count";

const REFRESH_MS = 60_000;

/**
 * Pending booking requests for the signed-in doctor, for the Dashboard tab badge.
 * Refreshes on navigation, on focus and every minute; the dashboard pushes its
 * live count so the badge changes the moment a request is handled.
 */
export function usePendingRequestsCount(enabled: boolean, pathname: string): number | null {
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/doctor-dashboard/pending-count", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as { count?: unknown } | null;
      if (typeof data?.count === "number") setCount(data.count);
    } catch {
      // Keep the last known count; the badge is a hint, not critical.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, pathname, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    const unsubscribe = subscribePendingRequestsCount(setCount);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
      unsubscribe();
    };
  }, [enabled, refresh]);

  return enabled ? count : null;
}
