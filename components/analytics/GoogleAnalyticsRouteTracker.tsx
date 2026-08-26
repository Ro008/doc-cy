"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const GTAG_WAIT_MS = 100;
const GTAG_WAIT_MAX_MS = 5000;

/** Send a GA4 page_view on App Router navigations (gtag config does not run again). */
export function GoogleAnalyticsRouteTracker({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!measurementId) return;

    const send = () => {
      if (typeof window.gtag !== "function") return false;
      window.gtag("event", "page_view", {
        page_path: pathname,
        send_to: measurementId,
      });
      return true;
    };

    if (send()) return;

    const started = Date.now();
    const timer = window.setInterval(() => {
      if (send() || Date.now() - started >= GTAG_WAIT_MAX_MS) {
        window.clearInterval(timer);
      }
    }, GTAG_WAIT_MS);

    return () => window.clearInterval(timer);
  }, [pathname, measurementId]);

  return null;
}
