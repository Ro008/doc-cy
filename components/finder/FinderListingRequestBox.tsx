import type { ReactNode } from "react";
import { finderCardCalendarAreaClass } from "@/components/finder/finder-availability-layout";
import { REQUEST_ONLINE_BOOKING_BUTTON_LABEL } from "@/components/finder/FinderManualCardAvailabilityGrid";
import {
  FINDER_MANUAL_CALENDAR_ATTR,
  FINDER_MANUAL_REQUEST_ATTR,
} from "@/lib/finder-manual-slot-click";

/**
 * G's listing box (Finder G, step 4; user, 2026-10-16), in place of the blurred calendar of
 * invented times: not on online booking yet, how many people asked, and the button to ask.
 * The click is handled by the results surface (`FinderResultsAvailabilityShell`), as before.
 */
export function FinderListingRequestBox({
  manualId,
  clinicId,
  requestSource,
  requestCount,
  footer = null,
}: {
  manualId: string;
  clinicId?: string | null;
  requestSource: string;
  requestCount: number;
  /** Claim this Profile and Report incorrect info, along the bottom of the box. */
  footer?: ReactNode;
}) {
  return (
    <div className={finderCardCalendarAreaClass}>
      <div
        data-testid="finder-listing-request-box"
        {...{ [FINDER_MANUAL_CALENDAR_ATTR]: "" }}
        data-manual-id={manualId}
        data-clinic-id={String(clinicId ?? "").trim() || undefined}
        data-request-source={requestSource}
        className="flex flex-1 flex-col justify-between gap-3 rounded-2xl bg-site-ink-50 p-4"
      >
        <div className="flex flex-wrap items-center gap-3.5">
        <div className="min-w-0 flex-[1_1_220px]">
          <p className="text-[15px] font-bold text-site-ink-900">Not on online booking yet</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-site-ink-500">
            {requestCount > 0 ? (
              <>
                <svg
                  aria-hidden
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#E8590C"
                  strokeWidth="2"
                  strokeLinejoin="round"
                >
                  <path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z" />
                </svg>
                {requestCount === 1 ? "1 person has asked for it" : `${requestCount} people have asked for it`}
              </>
            ) : (
              "Ask for it: it takes a second, no account needed."
            )}
          </p>
        </div>
        <button
          type="button"
          {...{ [FINDER_MANUAL_REQUEST_ATTR]: "" }}
          data-testid="finder-manual-request-online-booking"
          className="inline-flex min-h-[40px] items-center rounded-xl bg-ink-900 px-4 text-sm font-bold text-white transition-none hover:bg-ink-800 [.doccy-profile[data-scheme=dark]_&]:bg-clinical-500 [.doccy-profile[data-scheme=dark]_&]:text-[#062F61]"
        >
          {REQUEST_ONLINE_BOOKING_BUTTON_LABEL}
        </button>
        </div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2" data-testid="finder-listing-footer">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
