"use client";

import { format, isSameDay, isSameMonth } from "date-fns";
import { enGB } from "date-fns/locale";
import { Phone } from "lucide-react";
import { MANUAL_BOOKING_LABEL } from "@/lib/agenda-booking-source";
import {
  agendaAppointmentBadgeClass,
  agendaAppointmentPendingClass,
  agendaAppointmentTimeClass,
  agendaHolidayTagClass,
} from "@/components/agenda/agenda-surface";
import { agendaMonthGrid, monthDayVisibleCount, splitMonthDayItems } from "@/lib/agenda-calendar";

export type AgendaMonthItem = {
  key: string;
  timeLabel: string;
  patientName: string;
  clinicName: string | null;
  isPendingRequest: boolean;
  /** Greyed out (a request that expired unanswered). */
  isExpired?: boolean;
  /** Added by hand (phone or walk-in): shown with a small phone. */
  isManual?: boolean;
  /** A time held for a patient who was offered it: tagged "Proposed slot" instead of "Pending". */
  isProposedSlot?: boolean;
  /** Tailwind background class for the dot (clinic color). */
  dotClass: string;
  onOpen: () => void;
};

type Props = {
  anchor: Date;
  today: Date;
  itemsForDay: (dateKey: string) => AgendaMonthItem[];
  isWorkingDay: (date: Date) => boolean;
  /** A day of her holiday: washed amber and tagged. */
  isHoliday?: (date: Date) => boolean;
  onOpenDay: (date: Date) => void;
  /**
   * Desktop: the height the whole month takes, so it fills the window without
   * scrolling; each day then shows as many appointments as fit. Null on phones.
   */
  height?: number | null;
};

/** The row of weekday names above the days. */
const WEEKDAY_ROW_PX = 33;

/** Google Calendar–style month: up to 3 appointments per day, then "+N more" (opens the day). */
export function AgendaMonthGrid({
  anchor,
  today,
  itemsForDay,
  isWorkingDay,
  isHoliday,
  onOpenDay,
  height = null,
}: Props) {
  const weeks = agendaMonthGrid(anchor);
  const cellHeight = height != null ? (height - WEEKDAY_ROW_PX) / weeks.length : null;

  return (
    <div
      className={`min-w-0 ${height != null ? "flex flex-col" : ""}`}
      style={height != null ? { height } : undefined}
      data-testid="agenda-month-grid"
    >
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
      <div
        className={`grid grid-cols-7 border-l border-white/[0.08] ${height != null ? "min-h-0 flex-1" : ""}`}
        style={
          height != null ? { gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` } : undefined
        }
      >
        {weeks.flat().map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const items = itemsForDay(dateKey);
          const { visible, hiddenCount } =
            cellHeight != null
              ? splitMonthDayItems(items, monthDayVisibleCount({ cellHeight, itemCount: items.length }))
              : splitMonthDayItems(items);
          const holiday = Boolean(isHoliday?.(day));
          const inMonth = isSameMonth(day, anchor);
          const isToday = isSameDay(day, today);
          const dayLabel = format(day, "EEEE d MMMM", { locale: enGB });
          return (
            <div
              key={dateKey}
              data-testid={`agenda-month-day-${dateKey}`}
              data-holiday={holiday ? "true" : "false"}
              className={`relative flex min-w-0 flex-col gap-0.5 border-b border-r border-white/[0.08] p-0.5 md:p-1 ${
                height != null ? "min-h-0 overflow-hidden" : "min-h-[5.75rem] md:min-h-[7.5rem]"
              } ${holiday ? "bg-amber-400/[0.09]" : isWorkingDay(day) ? "" : "bg-black/25"}`}
            >
              {holiday ? (
                <span className={`absolute left-1 top-1.5 hidden md:inline ${agendaHolidayTagClass}`}>Holiday</span>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                aria-label={`Open ${dayLabel}${holiday ? " (holiday)" : ""}`}
                className={`mx-auto flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-1.5 text-xs tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 ${
                  isToday
                    ? "bg-clinical-500 font-bold text-ink-900 hover:bg-clinical-400"
                    : inMonth
                      ? "font-medium text-slate-100 hover:bg-white/15"
                      : "text-slate-500 hover:bg-white/10"
                } ${holiday && !isToday ? "ring-1 ring-amber-400/70 md:ring-0" : ""}`}
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

              {/* Phone: Google Calendar–style chips in the clinic colour with the patient's name,
                  up to 3 then "+N"; tapping opens the day (user, 2026-10-07). */}
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={`${items.length} appointments on ${dayLabel}`}
                  data-testid="agenda-month-day-chips"
                  className="-mx-px flex min-w-0 flex-col gap-px rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 md:hidden"
                >
                  {visible.map((item) => (
                    <span
                      key={item.key}
                      className={`block min-w-0 overflow-hidden whitespace-nowrap rounded-[3px] px-[3px] py-px text-[10px] font-medium leading-tight tracking-tight ${
                        // Pending (requests and proposed slots) in the amber box, as on desktop.
                        item.isPendingRequest
                          ? "bg-amber-500/10 text-amber-100 ring-1 ring-inset ring-amber-400/70"
                          : item.isExpired
                            ? "bg-slate-600 text-slate-200"
                            : `${item.dotClass} text-ink-900`
                      }`}
                    >
                      {item.isManual ? (
                        <Phone className="mr-0.5 inline h-2 w-2 align-[-1px]" aria-label={MANUAL_BOOKING_LABEL} />
                      ) : null}
                      {item.patientName}
                    </span>
                  ))}
                  {hiddenCount > 0 ? (
                    <span className="px-1 text-[10px] font-semibold leading-tight text-slate-300">+{hiddenCount}</span>
                  ) : null}
                </button>
              ) : null}

              <div className="hidden min-w-0 flex-col gap-0.5 md:flex">
                {visible.map((item) =>
                  item.isProposedSlot ? (
                    // Same look and behaviour as the week and day blocks: dashed amber box, the
                    // clinic's colour as a bar on the left, one line; the name shrinks, the badge never does.
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.onOpen}
                      aria-label={`Appointment ${item.patientName} at ${item.timeLabel}${item.clinicName ? ` · ${item.clinicName}` : ""}`}
                      title={`${item.timeLabel} · ${item.patientName}`}
                      className={`relative flex min-w-0 items-center gap-0.5 overflow-hidden rounded-md border py-1 pl-2.5 pr-1.5 text-left text-xs font-semibold leading-tight transition focus:outline-none ${agendaAppointmentPendingClass}`}
                    >
                      <span className={`absolute inset-y-0 left-0 w-1 ${item.dotClass}`} aria-hidden />
                      <span className={agendaAppointmentTimeClass}>{item.timeLabel}</span>
                      <span className="shrink-0 text-white/50">·</span>
                      <span className="min-w-0 flex-1 truncate">{item.patientName}</span>
                      <span
                        data-testid="agenda-month-pending-tag"
                        className={`ml-1 shrink-0 whitespace-nowrap ${agendaAppointmentBadgeClass}`}
                      >
                        Proposed slot
                      </span>
                    </button>
                  ) : (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onOpen}
                    aria-label={`Appointment ${item.patientName} at ${item.timeLabel}${item.clinicName ? ` · ${item.clinicName}` : ""}`}
                    title={`${item.timeLabel} · ${item.patientName}`}
                    className={`flex min-w-0 items-center gap-x-1.5 gap-y-0.5 rounded px-1.5 py-0.5 text-left text-xs transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 ${
                      // One line each when the month is sized to the window, so the count that fits holds.
                      height != null ? "shrink-0 flex-nowrap" : "flex-wrap"
                    } ${
                      item.isPendingRequest
                        ? "bg-amber-500/10 text-amber-100 ring-1 ring-inset ring-amber-400/40"
                        : "text-slate-100"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        item.dotClass
                      }`}
                      aria-hidden
                    />
                    <span className="shrink-0 tabular-nums text-slate-400">{item.timeLabel}</span>
                    <span className="min-w-0 max-w-full truncate">{item.patientName}</span>
                    {item.isPendingRequest ? (
                      <span
                        data-testid="agenda-month-pending-tag"
                        className="ml-auto shrink-0 rounded-sm bg-amber-400/20 px-1 text-[9px] font-bold uppercase tracking-wide text-amber-200"
                      >
                        Pending
                      </span>
                    ) : null}
                    {item.isManual ? (
                      <Phone className="h-3 w-3 shrink-0 text-slate-400" aria-label={MANUAL_BOOKING_LABEL} />
                    ) : null}
                  </button>
                  ),
                )}
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
