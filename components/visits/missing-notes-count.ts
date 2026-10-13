import * as React from "react";

/**
 * The "Without notes" number follows what she saves on the page (user, 2026-10-13): the server
 * counted it when the page loaded; saving or clearing a visit's notes moves it by one here, and
 * the next load from the server starts again from its own count.
 */
let change = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** A visit just lost its notes (+1) or got its first ones (-1). */
export function noteMissingNotesChange(by: 1 | -1): void {
  change += by;
  emit();
}

export function resetMissingNotesChanges(): void {
  if (change === 0) return;
  change = 0;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMissingNotesChange(): number {
  return React.useSyncExternalStore(
    subscribe,
    () => change,
    () => 0,
  );
}
