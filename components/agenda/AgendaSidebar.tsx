"use client";

import * as React from "react";
import Link from "next/link";
import { addMonths, format, isSameDay, isSameMonth, startOfMonth } from "date-fns";
import { enGB } from "date-fns/locale";
import { CalendarPlus, ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { MANUAL_BOOKING_LABEL as MANUAL_MARK_LABEL } from "@/lib/agenda-booking-source";
import { agendaMonthGrid } from "@/lib/agenda-calendar";
import { DASHBOARD_NEEDS_ANSWER_HREF } from "@/lib/doctor-dashboard";
import { MANUAL_BOOKING_HINT, MANUAL_BOOKING_LABEL } from "@/lib/manual-booking-copy";
import type { AgendaClinic } from "@/lib/agenda-clinics";
import { AgendaClinicCalendars } from "@/components/agenda/AgendaClinicCalendars";

type Props = {
  anchor: Date;
  today: Date;
  /** Days currently shown in the main grid (highlighted in the mini month). */
  rangeDays: readonly Date[];
  onPickDate: (date: Date) => void;
  onCreate: () => void;
  pendingCount: number;
  clinics: readonly AgendaClinic[];
  hiddenClinicIds: ReadonlySet<string>;
  onToggleClinic: (clinicId: string) => void;
};

export function AgendaSidebar({
  anchor,
  today,
  rangeDays,
  onPickDate,
  onCreate,
  pendingCount,
  clinics,
  hiddenClinicIds,
  onToggleClinic,
}: Props) {
  const [miniMonth, setMiniMonth] = React.useState(() => startOfMonth(anchor));
  const anchorMonthKey = format(anchor, "yyyy-MM");
  React.useEffect(() => {
    setMiniMonth(startOfMonth(anchor));
    // Follow the main grid when it moves to another month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorMonthKey]);

  const weeks = agendaMonthGrid(miniMonth);
  const inRange = (day: Date) => rangeDays.some((d) => isSameDay(d, day));

  return (
    <aside
      className="hidden w-64 shrink-0 flex-col gap-6 border-r border-white/10 p-4 lg:flex"
      data-testid="agenda-sidebar"
    >
      <button
        type="button"
        onClick={onCreate}
        title={MANUAL_BOOKING_HINT}
        className="inline-flex h-12 items-center gap-2 self-start rounded-2xl bg-clinical-500 pl-4 pr-5 text-sm font-semibold text-ink-900 shadow-md shadow-clinical-500/20 transition hover:bg-clinical-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300"
      >
        <CalendarPlus className="h-5 w-5" aria-hidden />
        {MANUAL_BOOKING_LABEL}
      </button>

      <div className="space-y-2" data-testid="agenda-mini-month">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">
            {format(miniMonth, "MMMM yyyy", { locale: enGB })}
          </p>
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => setMiniMonth((m) => addMonths(m, -1))}
              aria-label="Previous month (mini calendar)"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMiniMonth((m) => addMonths(m, 1))}
              aria-label="Next month (mini calendar)"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-0.5 text-center text-[11px]">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="py-1 text-[10px] font-medium text-slate-500" aria-hidden>
              {d}
            </span>
          ))}
          {weeks.flat().map((day) => {
            const isToday = isSameDay(day, today);
            const highlighted = inRange(day);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onPickDate(day)}
                aria-label={format(day, "EEEE d MMMM yyyy", { locale: enGB })}
                aria-current={isToday ? "date" : undefined}
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 ${
                  isToday
                    ? "bg-clinical-500 font-bold text-ink-900"
                    : highlighted
                      ? "bg-clinical-500/20 text-clinical-100 hover:bg-clinical-500/30"
                      : isSameMonth(day, miniMonth)
                        ? "text-slate-200 hover:bg-white/10"
                        : "text-slate-500 hover:bg-white/10"
                }`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {pendingCount > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Needs your action
          </p>
          <Link
            href={DASHBOARD_NEEDS_ANSWER_HREF}
            data-testid="agenda-pending-requests"
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-amber-400/80 px-3 py-2.5 text-left text-sm font-medium text-amber-100 transition hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <span>Pending requests</span>
            <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-amber-950">
              {pendingCount}
            </span>
          </Link>
        </div>
      ) : null}

      <AgendaClinicCalendars
        clinics={clinics}
        hiddenIds={hiddenClinicIds}
        onToggle={onToggleClinic}
        variant="list"
      />

      <div className="mt-auto space-y-1.5 text-[11px] text-slate-400">
        <p className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] bg-clinical-800" aria-hidden />
          Confirmed
        </p>
        <p className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] border border-dashed border-amber-400" aria-hidden />
          Pending request
        </p>
        <p className="flex items-center gap-2">
          <Phone className="h-3 w-3 shrink-0" aria-hidden />
          {MANUAL_MARK_LABEL}
        </p>
        <p className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.45)_0_3px,rgba(176,192,206,0.15)_3px_6px)] ring-1 ring-white/10" aria-hidden />
          Outside working hours
        </p>
      </div>
    </aside>
  );
}
