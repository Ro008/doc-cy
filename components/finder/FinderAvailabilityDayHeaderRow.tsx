import type { FinderAvailabilityDayHeader } from "@/lib/public/compute-public-booking-slots";

type Props = {
  days: FinderAvailabilityDayHeader[];
};

export function FinderAvailabilityDayHeaderCell({
  day,
}: {
  day: FinderAvailabilityDayHeader;
}) {
  return (
    <div className="px-0.5 py-1.5 text-center">
      <p className="truncate text-[9px] lg:text-[11px] font-bold uppercase tracking-[0.06em] text-ink-600">
        {day.isToday ? "TODAY" : day.weekdayLabel}
      </p>
      <p className="truncate text-[10px] lg:text-xs font-semibold leading-tight text-ink-800">
        {day.dateLabel}
      </p>
    </div>
  );
}

export function FinderAvailabilityDayHeaderRow({ days }: Props) {
  if (days.length === 0) return null;

  return (
    <div
      data-testid="finder-availability-day-header"
      className="grid gap-x-2 divide-x divide-ink-100 border-b border-ink-100 bg-ink-50"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
    >
      {days.map((day) => (
        <FinderAvailabilityDayHeaderCell key={day.dateKey} day={day} />
      ))}
    </div>
  );
}
