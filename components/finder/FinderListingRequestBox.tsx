import type { ReactNode } from "react";
import { CalendarPlus } from "lucide-react";
import { finderCardCalendarAreaClass } from "@/components/finder/finder-availability-layout";
import { REQUEST_ONLINE_BOOKING_BUTTON_LABEL } from "@/components/finder/FinderManualCardAvailabilityGrid";
import {
  FINDER_MANUAL_CALENDAR_ATTR,
  FINDER_MANUAL_REQUEST_ATTR,
} from "@/lib/finder-manual-slot-click";
import { formatFinderRequestBadgeLabel } from "@/lib/finder-booking-request-stats";

/**
 * G's listing box (Finder G, step 4; user, 2026-10-16), in place of the blurred calendar of
 * invented times: the old request box's words (how many asked, "Want to book an appointment
 * online?", the teal button, "Takes 1 second"), laid out across the card. Phones keep the
 * count, the button and the footer. The click is handled by the results surface
 * (`FinderResultsAvailabilityShell`), as before.
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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <div className="min-w-0 flex-[1_1_260px]">
            <p
              role="status"
              className="inline-block rounded-md border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-xs font-bold leading-snug text-amber-950"
            >
              {formatFinderRequestBadgeLabel(requestCount) ?? "🔥 Be the first to request online booking"}
            </p>
            <p className="mt-1.5 text-[15px] font-bold text-site-ink-900 max-sm:hidden">Want to book an appointment online?</p>
            <p className="mt-0.5 text-[13px] text-site-ink-500 max-sm:hidden">
              This professional hasn&apos;t activated online booking yet.
            </p>
          </div>
          <div className="flex w-full flex-col items-center gap-1 sm:w-auto">
            <button
              type="button"
              {...{ [FINDER_MANUAL_REQUEST_ATTR]: "" }}
              data-testid="finder-manual-request-online-booking"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-clinical-800 px-5 text-[15px] font-bold text-white shadow-[0_1px_2px_rgba(10,107,114,0.25)] transition-none hover:bg-clinical-900 sm:w-auto [.doccy-profile[data-scheme=dark]_&]:bg-clinical-500 [.doccy-profile[data-scheme=dark]_&]:text-[#062F61] [.doccy-profile[data-scheme=dark]_&]:hover:bg-clinical-400"
            >
              <CalendarPlus className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {REQUEST_ONLINE_BOOKING_BUTTON_LABEL}
            </button>
            <p className="text-xs text-site-ink-500 max-sm:hidden">Takes 1 second. No account needed.</p>
          </div>
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
