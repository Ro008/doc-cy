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

type Props = {
  manualId: string;
  dayHeaders: readonly FinderAvailabilityDayHeader[];
  anchorStickyWeekNav?: boolean;
};

export function FinderManualCardAvailabilityGrid({
  manualId,
  dayHeaders,
  anchorStickyWeekNav = false,
}: Props) {
  const previewCalendar = buildManualPreviewCalendar([...dayHeaders], manualId);
  if (previewCalendar.length === 0) return null;

  return (
    <div
      data-testid="finder-card-calendar-preview"
      {...{ [FINDER_MANUAL_CALENDAR_ATTR]: "" }}
      data-manual-id={manualId}
    >
      <div className="rounded-lg border border-ink-200 bg-ink-50/50">
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
                <div className="flex min-h-[5.5rem] flex-1 flex-col gap-1 p-1.5">
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
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-white/35 p-2">
            <button
              type="button"
              {...{ [FINDER_MANUAL_REQUEST_ATTR]: "" }}
              data-testid="finder-manual-request-online-booking"
              aria-label="Request online booking"
              className="w-[calc(100%-0.5rem)] max-w-[17rem] rounded-xl border border-amber-200 bg-white/95 px-3 py-2.5 text-center shadow-[0_8px_24px_rgba(26,43,60,0.12)] transition hover:border-clinical-300 hover:bg-white"
            >
              <span className="block text-[11px] leading-snug text-ink-800">
                This professional hasn&apos;t activated online booking yet.
              </span>
              <span className="mt-1.5 block text-xs font-semibold text-clinical-700 underline decoration-clinical-300 underline-offset-2">
                Click here to request it.
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
