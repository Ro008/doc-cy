/**
 * Agenda calendar surfaces — solid dark chrome + high-contrast appointment chips.
 * Prefer these tokens over one-off slate/clinical opacity stacks.
 */

export const agendaCalendarShellClass =
  "min-w-0 rounded-3xl border border-slate-700 bg-slate-950 shadow-xl shadow-black/40";

export const agendaToolbarDividerClass = "border-b border-slate-700";

export const agendaStickyWeekHeaderClass =
  "sticky top-0 z-20 grid grid-cols-[64px_repeat(5,minmax(104px,1fr))] gap-3 border-b border-slate-700 bg-slate-950 pb-2 pt-1 lg:grid-cols-[72px_repeat(5,minmax(120px,1fr))] xl:grid-cols-[80px_repeat(5,minmax(140px,1fr))]";

export const agendaHourAxisClass =
  "relative shrink-0 text-xs tabular-nums text-slate-300";

export const agendaHourGridLineClass = "absolute inset-x-0 border-t border-slate-600/80";

/** Alternating hour bands — improves vertical scan (Phase C). */
export const agendaHourZebraBandClass =
  "pointer-events-none absolute inset-x-0 bg-white/[0.045]";

export const agendaHourZebraBandTodayClass =
  "pointer-events-none absolute inset-x-0 bg-clinical-500/[0.09]";

export function agendaHourAxisLabelClass(hour: number, startHour: number): string {
  const onZebraBand = (hour - startHour) % 2 === 0;
  return onZebraBand
    ? "absolute -translate-y-1/2 font-semibold tabular-nums text-slate-100"
    : "absolute -translate-y-1/2 font-medium tabular-nums text-slate-400";
}

/** Outside working hours / closed day — dims slot area without muddy transparency stacks. */
export const agendaOffHoursOverlayClass = "absolute inset-0 bg-slate-950/90";

export const agendaOffHoursBandClass = "absolute inset-x-0 bg-slate-950/85";

export const agendaBreakBandClass = "absolute inset-x-0 bg-slate-950/80";

export const agendaPrimaryChipButtonClass =
  "rounded-lg border border-clinical-500/60 bg-clinical-500/25 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-clinical-500/20 transition hover:border-clinical-400 hover:bg-clinical-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70";

export const agendaTodayChipButtonClass =
  "rounded-lg border border-clinical-500/60 bg-clinical-500/20 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-clinical-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70";

export const agendaNavIconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/50";

export const agendaAppointmentConfirmedClass =
  "border-clinical-500/70 bg-clinical-500/35 text-white shadow-md shadow-clinical-500/25 hover:bg-clinical-500/45 focus-visible:ring-2 focus-visible:ring-clinical-400/80";

export const agendaAppointmentPendingClass =
  "border-amber-400/75 bg-amber-500/30 text-amber-50 shadow-md shadow-amber-500/20 hover:bg-amber-500/40 focus-visible:ring-2 focus-visible:ring-amber-400/70";

export function agendaDayHeaderClass(isToday: boolean): string {
  const base = "min-w-0 rounded-xl border px-2 py-2 text-center text-xs";
  return isToday
    ? `${base} border-clinical-400 bg-clinical-500/30 text-white shadow-md shadow-clinical-500/25 ring-1 ring-clinical-400/40`
    : `${base} border-slate-600 bg-slate-900 text-slate-300`;
}

export function agendaDayColumnClass(isToday: boolean): string {
  const base = "relative min-w-0 overflow-hidden rounded-2xl border bg-slate-900";
  return isToday
    ? `${base} border-clinical-500/65 ring-2 ring-clinical-500/40 shadow-[inset_0_0_32px_rgba(18,184,192,0.07)]`
    : `${base} border-slate-700`;
}

/** Confirmed appointment card typography */
export const agendaAppointmentTimeClass =
  "shrink-0 tabular-nums text-[11px] font-bold leading-none text-white/90 sm:text-xs";

export const agendaAppointmentNameConfirmedClass = "text-white";

export const agendaAppointmentNamePendingClass = "text-amber-50";

export const agendaAppointmentBadgeClass =
  "rounded bg-amber-950/90 px-1 py-0 text-[10px] font-semibold leading-none text-amber-100 ring-1 ring-amber-400/40";
