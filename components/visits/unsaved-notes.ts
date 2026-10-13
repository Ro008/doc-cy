/**
 * Which visit cards hold notes she has typed and not saved (user, 2026-10-13).
 *
 * The Visits tab moves between filters and pages inside the app, which never asks before
 * leaving. So a filter or a link first goes through `leaveVisits`: with unsaved notes it asks
 * her, inside the page (components/visits/UnsavedNotesPrompt), and only moves on once she
 * chooses to leave. Closing or reloading the browser tab is covered by VisitNotesBox itself.
 */
const unsaved = new Map<string, () => void>();

/** `discard` closes that card's notes box, dropping what she typed; null once saved or closed. */
export function setNotesUnsaved(visitId: string, discard: (() => void) | null): void {
  if (discard) unsaved.set(visitId, discard);
  else unsaved.delete(visitId);
}

export function hasUnsavedNotes(): boolean {
  return unsaved.size > 0;
}

export function discardUnsavedNotes(): void {
  const all = Array.from(unsaved.values());
  unsaved.clear();
  for (const discard of all) discard();
}

type Ask = (proceed: () => void, cancel: () => void) => void;
let ask: Ask | null = null;

/** The prompt on the page registers itself here. */
export function setUnsavedNotesPrompt(next: Ask | null): void {
  ask = next;
}

/** Runs `proceed` right away, or after she agrees to drop her unsaved notes; `cancel` if she stays. */
export function leaveVisits(proceed: () => void, cancel: () => void = () => {}): void {
  if (!hasUnsavedNotes() || !ask) proceed();
  else ask(proceed, cancel);
}
