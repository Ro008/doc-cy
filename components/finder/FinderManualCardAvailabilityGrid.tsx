import { FinderAvailabilityDayHeaderCell } from "@/components/finder/FinderAvailabilityDayHeaderRow";
import { FinderAvailabilityStickyWeekHeader } from "@/components/finder/FinderAvailabilityStickyWeekHeader";
import {
  finderAvailabilitySlotClassName,
  finderAvailabilityWeekTrackClassName,
} from "@/components/finder/finder-availability-layout";
import { buildManualPreviewCalendar } from "@/lib/finder-manual-preview-calendar";
import {
  FINDER_MANUAL_CALENDAR_ATTR,
  FINDER_MANUAL_SLOT_ATTR,
} from "@/lib/finder-manual-slot-click";
import type { FinderAvailabilityDayHeader } from "@/lib/public/compute-public-booking-slots";

type Props = {
  manualId: string;
  doctorName: string;
  addressMapsLink: string;
  dayHeaders: readonly FinderAvailabilityDayHeader[];
  hasPhone?: boolean;
  addressText?: string | null;
  anchorStickyWeekNav?: boolean;
};

export function FinderManualCardAvailabilityGrid({
  manualId,
  doctorName,
  addressMapsLink,
  dayHeaders,
  hasPhone = false,
  addressText = null,
  anchorStickyWeekNav = false,
}: Props) {
  const previewCalendar = buildManualPreviewCalendar([...dayHeaders], manualId);
  if (previewCalendar.length === 0) return null;

  const address = String(addressText ?? "").trim();

  return (
    <div
      data-testid="finder-card-calendar-preview"
      {...{ [FINDER_MANUAL_CALENDAR_ATTR]: "" }}
      data-manual-id={manualId}
      data-doctor-name={doctorName}
      data-maps-link={addressMapsLink}
      data-has-phone={hasPhone ? "1" : "0"}
      data-address={address}
    >
      <div className="rounded-lg border border-ink-200 bg-white">
        {anchorStickyWeekNav ? (
          <FinderAvailabilityStickyWeekHeader />
        ) : (
          <div className="overflow-hidden border-b border-ink-100 bg-ink-50">
            <div className={finderAvailabilityWeekTrackClassName}>
              {previewCalendar.map((day) => (
                <FinderAvailabilityDayHeaderCell key={day.dateKey} day={day} />
              ))}
            </div>
          </div>
        )}
        <div className="overflow-hidden">
          <div className={`${finderAvailabilityWeekTrackClassName} items-stretch`}>
            {previewCalendar.map((day) => (
              <div key={day.dateKey} className="flex min-w-0 flex-col">
                <div className="flex min-h-[5.5rem] flex-1 flex-col gap-1 p-1.5">
                  {day.slots.map((slot) => (
                    <button
                      key={slot.slotKey}
                      type="button"
                      {...{ [FINDER_MANUAL_SLOT_ATTR]: "" }}
                      data-slot-key={slot.slotKey}
                      className={finderAvailabilitySlotClassName}
                      title={`Request online booking for ${day.weekdayLabel} ${day.dateLabel} at ${slot.timeLabel}`}
                    >
                      <span className="whitespace-nowrap tabular-nums">{slot.timeLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
