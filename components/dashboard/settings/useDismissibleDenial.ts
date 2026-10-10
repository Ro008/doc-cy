"use client";

import * as React from "react";
import type { DeniedProfileChange } from "@/lib/profile-change-requests";

/** Denials she dismissed, by request id: kept in this browser only. */
const storageKey = (kind: "name" | "photo" | "specialty") => `doccy:dismissed-${kind}-denial`;

/**
 * Her latest denied request of one kind, until she dismisses it (user, 2026-10-10).
 * Shown after mount, once this browser's dismissals are known. Returns the denial to
 * show, a dismiss action, and a way to clear it when she sends a new request.
 */
export function useDismissibleDenial(
  kind: "name" | "photo" | "specialty",
  initialDenied: DeniedProfileChange | null,
): [DeniedProfileChange | null, () => void, () => void] {
  const [denied, setDenied] = React.useState<DeniedProfileChange | null>(null);

  React.useEffect(() => {
    let dismissedId: string | null = null;
    try {
      dismissedId = window.localStorage.getItem(storageKey(kind));
    } catch {
      // Storage blocked: show the denial.
    }
    setDenied(initialDenied && dismissedId !== initialDenied.id ? initialDenied : null);
  }, [kind, initialDenied]);

  const dismiss = React.useCallback(() => {
    setDenied((current) => {
      if (current) {
        try {
          window.localStorage.setItem(storageKey(kind), current.id);
        } catch {
          // Private window: it stays dismissed for this visit only.
        }
      }
      return null;
    });
  }, [kind]);

  const clear = React.useCallback(() => setDenied(null), []);
  return [denied, dismiss, clear];
}
