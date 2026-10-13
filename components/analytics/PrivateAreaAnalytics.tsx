"use client";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { isPrivateAreaPath } from "@/lib/analytics-scope";

function pathOf(url: string): string | null {
  try {
    return new URL(url, "https://example.invalid").pathname;
  } catch {
    return null;
  }
}

/**
 * Vercel Web Analytics and Speed Insights, silent inside the doctor's internal area (user,
 * 2026-10-12): they send the full URL of the page, and a Visits search or a sign-in link can
 * carry patient data or a token there. Events for those pages are dropped before sending.
 */
export function PrivateAreaAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => (isPrivateAreaPath(pathOf(event.url)) ? null : event)} />
      <SpeedInsights beforeSend={(event) => (isPrivateAreaPath(pathOf(event.url)) ? null : event)} />
    </>
  );
}
