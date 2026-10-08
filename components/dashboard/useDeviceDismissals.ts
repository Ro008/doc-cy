"use client";

import * as React from "react";
import { parseDismissedIds } from "@/lib/reschedule-follow-up";

/** "Close" fades and folds the item away first (user, 2026-10-08). */
export const CLOSE_FADE_MS = 300;

/**
 * Dashboard notices she can Close on this device only (localStorage under `storageKey`):
 * `closing` holds the ones fading out, `dismissed` the ones already gone.
 */
export function useDeviceDismissals(storageKey: string) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set());
  const [closing, setClosing] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    try {
      setDismissed(parseDismissedIds(window.localStorage.getItem(storageKey)));
    } catch {
      // Storage blocked: nothing was closed on this device.
    }
  }, [storageKey]);

  const close = React.useCallback(
    (id: string) => {
      setClosing((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      window.setTimeout(() => {
        setDismissed((prev) => {
          const next = new Set(prev).add(id);
          try {
            window.localStorage.setItem(storageKey, JSON.stringify([...next]));
          } catch {
            // Hidden for this visit only.
          }
          return next;
        });
        setClosing((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, CLOSE_FADE_MS);
    },
    [storageKey],
  );

  return { dismissed, closing, close };
}
