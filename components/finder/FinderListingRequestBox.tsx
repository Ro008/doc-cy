import { CalendarPlus } from "lucide-react";
import { finderCardTimesAreaClass } from "@/components/finder/finder-availability-layout";
import { FinderCardWeek } from "@/components/finder/FinderCardWeek";
import { REQUEST_ONLINE_BOOKING_BUTTON_LABEL } from "@/components/finder/FinderManualCardAvailabilityGrid";
import { finderCardRequestCountText } from "@/lib/finder-profile-card";
import {
  FINDER_MANUAL_CALENDAR_ATTR,
  FINDER_MANUAL_REQUEST_ATTR,
} from "@/lib/finder-manual-slot-click";

/**
 * A listing's week, grey, with the request in the times' place (mockup L; user,
 * 2026-10-16): the question, how many patients asked (nothing at 0), the button, and the
 * reassurance line centred under it. The click is handled by the results surface
 * (`FinderResultsAvailabilityShell`), as before.
 */
export function FinderListingRequestBox({
  manualId,
  clinicId,
  requestSource,
  requestCount,
}: {
  manualId: string;
  clinicId?: string | null;
  requestSource: string;
  requestCount: number;
}) {
  const countText = finderCardRequestCountText(requestCount);
  return (
    <section aria-label="Online booking" className={finderCardTimesAreaClass}>
      <FinderCardWeek days={null} />
      <div
        data-testid="finder-listing-request-box"
        {...{ [FINDER_MANUAL_CALENDAR_ATTR]: "" }}
        data-manual-id={manualId}
        data-clinic-id={String(clinicId ?? "").trim() || undefined}
        data-request-source={requestSource}
        className="mt-4 flex max-w-[470px] flex-col gap-2 lg:mt-3.5"
      >
        <p className="text-base font-bold leading-[1.3] text-profile-text">Want to book an appointment online?</p>
        {countText ? (
          <p
            data-testid="finder-listing-request-count"
            className={"flex items-center gap-1.5 text-[13px] font-bold text-[#9A3F00] [.doccy-profile[data-scheme=dark]_&]:text-[#FFD8A8]"}
          >
            <svg
              aria-hidden
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinejoin="round"
              className={"shrink-0 stroke-[#E8590C] [.doccy-profile[data-scheme=dark]_&]:stroke-[#FF922B]"}
            >
              <path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z" />
            </svg>
            {countText}
          </p>
        ) : null}
        <div className="mt-0.5 flex w-full max-w-[287px] flex-col gap-2">
          {/* Pale teal, not the bright button (mockup R3; user, 2026-10-16: too strong). */}
          <button
            type="button"
            {...{ [FINDER_MANUAL_REQUEST_ATTR]: "" }}
            data-testid="finder-manual-request-online-booking"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-[14px] border border-[#9CD3D8] bg-[#E3F4F6] px-[18px] text-base font-bold text-[#0A5C63] transition-none hover:bg-[#D5EEF0] active:translate-y-px [.doccy-profile[data-scheme=dark]_&]:border-[#2E6E8E] [.doccy-profile[data-scheme=dark]_&]:bg-[#0E3358] [.doccy-profile[data-scheme=dark]_&]:text-[#7FE6EB] [.doccy-profile[data-scheme=dark]_&]:hover:bg-[#123E68]"
          >
            <CalendarPlus className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} aria-hidden />
            {REQUEST_ONLINE_BOOKING_BUTTON_LABEL}
          </button>
          <p className="text-center text-xs text-profile-muted">Takes 1 second. No account needed.</p>
        </div>
      </div>
    </section>
  );
}
