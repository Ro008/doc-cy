"use client";

import { format, isSameDay, isSameMonth } from "date-fns";
import { enGB } from "date-fns/locale";
import { Phone } from "lucide-react";
import { MANUAL_BOOKING_LABEL } from "@/lib/agenda-booking-source";
import { agendaMonthGrid, splitMonthDayItems } from "@/lib/agenda-calendar";

export type AgendaMonthItem = {
  key: string;
  timeLabel: string;
  patientName: string;
  clinicName: string | null;
  isPendingRequest: boolean;
  /** Added by hand (phone or walk-in): shown with a small phone. */
  isManual?: boolean;
  /** Tailwind background class for the dot (clinic color). */
  dotClass: string;
  onOpen: () => void;
};

type Props = {
  anchor: Date;
  today: Date;
  itemsForDay: (dateKey: string) => AgendaMonthItem[];
  isWorkingDay: (date: Date) => boolean;
  onOpenDay: (date: Date) => void;
};

/** Google Calendar–style month: up to 3 appointments per day, then "+N more" (opens the day). */
export function AgendaMonthGrid({ anchor, today, itemsForDay, isWorkingDay, onOpenDay }: Props) {
  const weeks = agendaMonthGrid(anchor);

  return (
    <div className="min-w-0" data-testid="agenda-month-grid">
      <div className="grid grid-cols-7 border-b border-white/10">
        {weeks[0]!.map((day) => (
          <p
            key={format(day, "EEE")}
            className="py-2 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400"
          >
            {format(day, "EEE", { locale: enGB })}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-white/[0.08]">
        {weeks.flat().map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const items = itemsForDay(dateKey);
          const { visible, hiddenCount } = splitMonthDayItems(items);
          const inMonth = isSameMonth(day, anchor);
          const isToday = isSameDay(day, today);
          const dayLabel = format(day, "EEEE d MMMM", { locale: enGB });
          return (
            <div
              key={dateKey}
              data-testid={`agenda-month-day-${dateKey}`}
              className={`flex min-h-[4.25rem] min-w-0 flex-col gap-0.5 border-b border-r border-white/[0.08] p-1 md:min-h-[7.5rem] ${
                isWorkingDay(day) ? "" : "bg-black/25"
              }`}
            >
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                aria-label={`Open ${dayLabel}`}
                className={`mx-auto flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-1.5 text-xs tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 ${
                  isToday
                    ? "bg-clinical-500 font-bold text-ink-900 hover:bg-clinical-400"
                    : inMonth
                      ? "font-medium text-slate-100 hover:bg-white/15"
                      : "text-slate-500 hover:bg-white/10"
                }`}
              >
                {day.getDate() === 1 ? (
                  <>
                    <span className="md:hidden">1</span>
                    <span className="hidden md:inline">{format(day, "d MMM", { locale: enGB })}</span>
                  </>
                ) : (
                  day.getDate()
                )}
              </button>

              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={`${items.length} appointments on ${dayLabel}`}
                  className="flex flex-wrap justify-center gap-0.5 rounded py-1 md:hidden"
                >
                  {items.slice(0, 4).map((item) => (
                    <span
                      key={item.key}
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.isPendingRequest ? "border border-amber-400" : item.dotClass
                      }`}
                      aria-hidden
                    />
                  ))}
                </button>
              ) : null}

              <div className="hidden min-w-0 flex-col gap-0.5 md:flex">
                {visible.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onOpen}
                    aria-label={`Appointment ${item.patientName} at ${item.timeLabel}${item.clinicName ? ` · ${item.clinicName}` : ""}`}
                    title={`${item.timeLabel} · ${item.patientName}`}
                    className={`flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-xs transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 ${
                      item.isPendingRequest ? "text-amber-100" : "text-slate-100"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        item.isPendingRequest ? "border-2 border-dashed border-amber-400" : item.dotClass
                      }`}
                      aria-hidden
                    />
                    <span className="shrink-0 tabular-nums text-slate-400">{item.timeLabel}</span>
                    <span className="min-w-0 truncate">{item.patientName}</span>
                    {item.isManual ? (
                      <Phone className="h-3 w-3 shrink-0 text-slate-400" aria-label={MANUAL_BOOKING_LABEL} />
                    ) : null}
                  </button>
                ))}
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    className="rounded px-1.5 py-0.5 text-left text-xs font-semibold text-slate-300 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70"
                  >
                    +{hiddenCount} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
