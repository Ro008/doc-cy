/** How long the agenda keeps a linked visit highlighted. */
export const AGENDA_HIGHLIGHT_MS = 2000;

/** Agenda on the visit's day, asking it to point the visit out. */
export function agendaHighlightHref(dateKey: string, appointmentId: string): string {
  const params = new URLSearchParams({ date: dateKey, highlight: appointmentId });
  return `/agenda?${params.toString()}`;
}

/** The `highlight` search param as a plain appointment id, or null. */
export function parseAgendaHighlight(raw: string | string[] | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return /^[A-Za-z0-9-]{1,64}$/.test(id) ? id : null;
}
