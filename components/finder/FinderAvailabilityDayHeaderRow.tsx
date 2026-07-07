import type { FinderAvailabilityDayHeader } from "@/lib/public/compute-public-booking-slots";

type Props = {
  days: FinderAvailabilityDayHeader[];
};

export function FinderAvailabilityDayHeaderRow({ days }: Props) {
  if (days.length === 0) return null;

  return (
    <div
      className="grid divide-x divide-ink-100 border-b border-ink-100 bg-ink-50"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
    >
      {days.map((day) => (
        <div key={day.dateKey} className="px-1 py-1.5 text-center">
          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {day.weekdayLabel}
          </p>
          <p className="truncate text-[10px] font-medium leading-tight text-ink-700">
            {day.dateLabel}
          </p>
        </div>
      ))}
    </div>
  );
}
