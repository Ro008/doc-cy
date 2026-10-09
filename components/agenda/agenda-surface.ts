/**
 * Agenda calendar surfaces — Google Calendar–style (design option A):
 * navy app surface, continuous grid, solid appointment blocks, hatched off-hours.
 */

/** App surface behind the calendar (matches the redesign mockup). */
const AGENDA_SURFACE_BG = "bg-[#041C3A]";

export const agendaCalendarShellClass =
  `min-w-0 overflow-visible rounded-3xl border border-white/10 ${AGENDA_SURFACE_BG} shadow-xl shadow-black/40`;

export const agendaToolbarDividerClass = "border-b border-white/10";

/** Pair with agendaWeekGridColsClass / agendaDayGridColsClass so the header lines up with the grid. */
export const agendaStickyWeekHeaderClass =
  `sticky top-0 z-30 grid min-h-[4.25rem] items-end border-b border-white/10 ${AGENDA_SURFACE_BG} py-2 lg:top-14`;

/** Week view: hour axis + 7 days (Mon–Sun), one continuous grid. */
export const agendaWeekGridColsClass =
  "grid-cols-[52px_repeat(7,minmax(0,1fr))] lg:grid-cols-[64px_repeat(7,minmax(0,1fr))]";

/** Day view (desktop) and the phone agenda: hour axis + one day. */
export const agendaDayGridColsClass = "grid-cols-[52px_minmax(0,1fr)] lg:grid-cols-[64px_minmax(0,1fr)]";

export const agendaHourAxisClass =
  "relative shrink-0 text-xs tabular-nums text-slate-400";

export const agendaHourGridLineClass = "absolute inset-x-0 border-t border-white/[0.08]";

export function agendaHourAxisLabelClass(_hour: number, _startHour: number): string {
  return "absolute -translate-y-1/2 pl-1 text-[11px] font-medium tabular-nums text-slate-400";
}

const OFF_HOURS_HATCH =
  "bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.32)_0_6px,rgba(176,192,206,0.05)_6px_12px)]";

/** Closed day — hatched over the whole column. */
export const agendaOffHoursOverlayClass = `absolute inset-0 ${OFF_HOURS_HATCH}`;

/** Before opening / after closing time. */
export const agendaOffHoursBandClass = `absolute inset-x-0 ${OFF_HOURS_HATCH}`;

export const agendaBreakBandClass =
  "absolute inset-x-0 bg-[repeating-linear-gradient(135deg,rgba(245,185,66,0.10)_0_5px,transparent_5px_10px)]";

export const agendaPrimaryChipButtonClass =
  "inline-flex items-center gap-1.5 rounded-full bg-clinical-500 px-4 py-1.5 text-[13px] font-semibold text-ink-900 transition hover:bg-clinical-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300";

export const agendaTodayChipButtonClass =
  "rounded-full border border-white/25 px-4 py-1.5 text-[13px] font-medium text-slate-50 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70";

export const agendaNavIconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70";

export const agendaAppointmentConfirmedClass =
  "border-clinical-800 bg-clinical-800 text-clinical-50 hover:border-clinical-700 hover:bg-clinical-700 focus-visible:ring-2 focus-visible:ring-clinical-300";

export const agendaAppointmentPendingClass =
  "border-dashed border-amber-400 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 focus-visible:ring-2 focus-visible:ring-amber-300";

/** Google Calendar–style week column headers (day label + large date). */
export const agendaDayHeaderShellClass =
  "flex min-w-0 flex-col items-center justify-end gap-0.5 text-center";

export function agendaDayNameClass(isToday: boolean): string {
  return isToday
    ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-clinical-300"
    : "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300";
}

export function agendaDayNumberClass(isToday: boolean): string {
  return isToday
    ? "flex h-10 w-10 items-center justify-center rounded-full bg-clinical-500 text-[22px] font-medium leading-none tabular-nums text-ink-900"
    : "flex h-10 w-10 items-center justify-center rounded-full text-[22px] font-normal leading-none tabular-nums text-slate-100";
}

export function agendaDayColumnClass(isToday: boolean): string {
  const base = "relative min-w-0 overflow-hidden border-l border-white/10";
  return isToday ? `${base} bg-clinical-500/[0.05]` : base;
}

/** Appointment block typography */
export const agendaAppointmentTimeClass =
  "shrink-0 tabular-nums text-[11px] font-medium leading-tight opacity-85";

export const agendaAppointmentNameConfirmedClass = "text-clinical-50";

export const agendaAppointmentNamePendingClass = "text-amber-100";

/** Request nobody answered before its time: muted, clearly not actionable as a booking. */
export const agendaAppointmentExpiredClass =
  "border-slate-600/80 bg-slate-800/70 text-slate-300 shadow-none hover:bg-slate-700/70 focus-visible:ring-2 focus-visible:ring-slate-400/60";

export const agendaAppointmentNameExpiredClass = "text-slate-300 line-through decoration-slate-500/60";

export const agendaAppointmentBadgeClass =
  "rounded bg-amber-950/90 px-1 py-0 text-[10px] font-semibold leading-none text-amber-100 ring-1 ring-amber-400/40";
