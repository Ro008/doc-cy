import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameMonth,
  isSameYear,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enGB } from "date-fns/locale";
import { DAY_NAMES, type WeeklySchedule } from "@/lib/doctor-settings";

export type AgendaView = "day" | "week" | "month";

export const DEFAULT_AGENDA_VIEW: AgendaView = "week";

/** Month cells show this many appointments before collapsing into "+N more". */
export const MONTH_DAY_VISIBLE_ITEMS = 3;

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export function parseAgendaView(raw: string | null | undefined): AgendaView {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "day" || value === "week" || value === "month"
    ? value
    : DEFAULT_AGENDA_VIEW;
}

/** The 7 days (Monday to Sunday) of the week containing `anchor`. */
export function agendaWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, WEEK_OPTIONS);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Monday-first weeks covering `anchor`'s month, padded with neighbour-month days. */
export function agendaMonthGrid(anchor: Date): Date[][] {
  const first = startOfWeek(startOfMonth(anchor), WEEK_OPTIONS);
  const last = endOfWeek(endOfMonth(anchor), WEEK_OPTIONS);
  const weeks: Date[][] = [];
  for (let weekStart = first; weekStart <= last; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
  }
  return weeks;
}

export function shiftAgendaAnchor(anchor: Date, view: AgendaView, delta: number): Date {
  if (view === "day") return addDays(anchor, delta);
  if (view === "month") return addMonths(anchor, delta);
  return addWeeks(anchor, delta);
}

export function agendaRangeTitle(anchor: Date, view: AgendaView): string {
  const fmt = (date: Date, pattern: string) => format(date, pattern, { locale: enGB });
  if (view === "day") return fmt(anchor, "EEEE, d MMMM yyyy");
  if (view === "month") return fmt(anchor, "MMMM yyyy");

  const days = agendaWeekDays(anchor);
  const start = days[0]!;
  const end = days[6]!;
  if (!isSameYear(start, end)) {
    return `${fmt(start, "d MMM yyyy")} – ${fmt(end, "d MMM yyyy")}`;
  }
  if (!isSameMonth(start, end)) {
    return `${fmt(start, "d MMM")} – ${fmt(end, "d MMM yyyy")}`;
  }
  return `${fmt(start, "d")} – ${fmt(end, "d MMM yyyy")}`;
}

export function splitMonthDayItems<T>(
  items: readonly T[],
  max: number = MONTH_DAY_VISIBLE_ITEMS,
): { visible: T[]; hiddenCount: number } {
  return {
    visible: items.slice(0, max),
    hiddenCount: Math.max(0, items.length - max),
  };
}

/** True when the doctor's schedule has this weekday switched off. No schedule → never greyed out. */
export function isAgendaNonWorkingDay(date: Date, schedule: WeeklySchedule | null): boolean {
  if (!schedule) return false;
  const dayKey = DAY_NAMES[(getDay(date) + 6) % 7]!;
  return !schedule[dayKey]?.enabled;
}

export function agendaHref({
  view,
  dateKey,
}: {
  view: AgendaView;
  dateKey: string | null;
}): string {
  const params = new URLSearchParams();
  if (view !== DEFAULT_AGENDA_VIEW) params.set("view", view);
  if (dateKey) params.set("date", dateKey);
  const query = params.toString();
  return query ? `/agenda?${query}` : "/agenda";
}

/** Height for the scrolling time grid so the page itself doesn't scroll (Google Calendar–style). */
export function agendaGridScrollHeight({
  viewportHeight,
  gridTop,
  bottomReserve,
  minHeight = 320,
}: {
  viewportHeight: number;
  gridTop: number;
  bottomReserve: number;
  minHeight?: number;
}): number {
  return Math.max(minHeight, Math.round(viewportHeight - gridTop - bottomReserve));
}

/** Where the time grid opens: two hours before now when today is visible, else the top. */
export function agendaInitialGridScrollTop({
  nowOffsetPx,
  hourRowHeight,
}: {
  nowOffsetPx: number | null;
  hourRowHeight: number;
}): number {
  if (nowOffsetPx == null) return 0;
  return Math.max(0, Math.round(nowOffsetPx - 2 * hourRowHeight));
}
