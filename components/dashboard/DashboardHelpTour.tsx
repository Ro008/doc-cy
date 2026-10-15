"use client";

import * as React from "react";
import Link from "next/link";
import { PlayCircle, X } from "lucide-react";

import { CLOSE_FADE_MS, useDeviceDismissals } from "@/components/dashboard/useDeviceDismissals";
import { HELP_LINKS, HELP_TOUR_DISMISSED_KEY, findHelpArticle, helpArticlePath } from "@/lib/help-manual";

const TOUR_ID = "dashboard-tour";

/**
 * A one-line invitation to the dashboard's tutorial. Closing it hides it on this device for good
 * (same pattern as the other Dashboard notices); it shows only once the device's choice is known,
 * so it never flashes for someone who already closed it.
 */
export function DashboardHelpTour() {
  const { dismissed, closing, close } = useDeviceDismissals(HELP_TOUR_DISMISSED_KEY);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);

  const article = findHelpArticle(HELP_LINKS.dashboardTour);
  if (!ready || !article?.video || dismissed.has(TOUR_ID)) return null;

  return (
    <aside
      data-testid="dashboard-help-tour"
      className="flex items-center gap-3 rounded-2xl border border-clinical-400/30 bg-gradient-to-r from-clinical-500/15 to-slate-900/60 px-4 py-3 transition-opacity motion-safe:animate-fade-up"
      style={{ opacity: closing.has(TOUR_ID) ? 0 : 1, transitionDuration: `${CLOSE_FADE_MS}ms` }}
    >
      <PlayCircle className="h-6 w-6 shrink-0 text-clinical-300" aria-hidden />
      <p className="min-w-0 flex-1 text-sm leading-5 text-slate-200">
        <span className="font-semibold text-slate-50">New here?</span> Watch the {article.video.durationLabel.replace(/^0:/, "")}-second tour
        of your dashboard.{" "}
        <Link
          href={helpArticlePath(article.slug)}
          className="font-semibold text-clinical-300 underline decoration-clinical-400/40 underline-offset-2 hover:text-clinical-200"
        >
          Watch the tour
        </Link>
      </p>
      <button
        type="button"
        onClick={() => close(TOUR_ID)}
        aria-label="Close"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-700/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  );
}
