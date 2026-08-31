import { FinderAvailabilityDayHeaderCell } from "@/components/finder/FinderAvailabilityDayHeaderRow";
import { FinderAvailabilityStickyWeekHeader } from "@/components/finder/FinderAvailabilityStickyWeekHeader";
import {
  finderAvailabilitySlotClassName,
  finderAvailabilityWeekTrackClassName,
} from "@/components/finder/finder-availability-layout";
import { buildManualPreviewCalendar } from "@/lib/finder-manual-preview-calendar";
import {
  FINDER_MANUAL_CALENDAR_ATTR,
  FINDER_MANUAL_REQUEST_ATTR,
} from "@/lib/finder-manual-slot-click";
import type { FinderAvailabilityDayHeader } from "@/lib/public/compute-public-booking-slots";

export const REQUEST_ONLINE_BOOKING_BUTTON_LABEL = "Request online booking";

type Props = {
  manualId: string;
  dayHeaders: readonly FinderAvailabilityDayHeader[];
  anchorStickyWeekNav?: boolean;
  /** Defaults to `manualId`. Distinct per practice location so multi-clinic previews differ. */
  seedKey?: string;
};

function CalendarPlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden
    >
      <path d="M16 19h6" />
      <path d="M16 2v4" />
      <path d="M19 16v6" />
      <path d="M21 8.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5" />
      <path d="M3 10h5" />
      <path d="M8 2v4" />
    </svg>
  );
}

export function FinderManualCardAvailabilityGrid({
  manualId,
  dayHeaders,
  anchorStickyWeekNav = false,
  seedKey,
}: Props) {
  const previewCalendar = buildManualPreviewCalendar(
    [...dayHeaders],
    String(seedKey ?? "").trim() || manualId,
  );
  if (previewCalendar.length === 0) return null;

  return (
    <div
      data-testid="finder-card-calendar-preview"
      {...{ [FINDER_MANUAL_CALENDAR_ATTR]: "" }}
      data-manual-id={manualId}
    >
      <div className="overflow-hidden rounded-lg border border-ink-200 bg-ink-50/50">
        {anchorStickyWeekNav ? (
          <FinderAvailabilityStickyWeekHeader />
        ) : (
          <div className="overflow-hidden border-b border-ink-100 bg-ink-50 opacity-50">
            <div className={finderAvailabilityWeekTrackClassName}>
              {previewCalendar.map((day) => (
                <FinderAvailabilityDayHeaderCell key={day.dateKey} day={day} />
              ))}
            </div>
          </div>
        )}
        <div className="relative overflow-hidden">
          <div
            className={`${finderAvailabilityWeekTrackClassName} pointer-events-none items-stretch opacity-45 grayscale`}
            aria-hidden
          >
            {previewCalendar.map((day) => (
              <div key={day.dateKey} className="flex min-w-0 flex-col">
                <div className="flex min-h-[10rem] flex-1 flex-col gap-1 p-1.5">
                  {day.slots.map((slot) => (
                    <span
                      key={slot.slotKey}
                      className={finderAvailabilitySlotClassName}
                    >
                      <span className="whitespace-nowrap tabular-nums">{slot.timeLabel}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-white/40 p-2">
            <div className="w-[calc(100%-0.5rem)] max-w-[18.5rem] rounded-xl border border-clinical-200/80 bg-white/95 px-3 py-3 text-center shadow-[0_8px_24px_rgba(26,43,60,0.12)]">
              <p className="text-balance text-[11px] font-semibold leading-snug text-ink-900">
                Want to book an appointment online?
              </p>
              <p className="mt-1 text-pretty text-[10px] leading-snug text-ink-600">
                This professional hasn&apos;t activated online booking yet.
              </p>
              <button
                type="button"
                {...{ [FINDER_MANUAL_REQUEST_ATTR]: "" }}
                data-testid="finder-manual-request-online-booking"
                aria-label={REQUEST_ONLINE_BOOKING_BUTTON_LABEL}
                className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-clinical-500 bg-clinical-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_1px_2px_rgba(18,184,192,0.22)] transition hover:border-clinical-600 hover:bg-clinical-600"
              >
                <CalendarPlusIcon />
                {REQUEST_ONLINE_BOOKING_BUTTON_LABEL}
              </button>
              <p className="mt-1.5 text-[10px] leading-snug text-ink-500">
                Takes 1 second. No account needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
