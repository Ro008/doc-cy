"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  discardUnsavedNotes,
  hasUnsavedNotes,
  leaveVisits,
  setUnsavedNotesPrompt,
} from "@/components/visits/unsaved-notes";

/**
 * Asks before a filter or a link takes her away from notes she has not saved (user,
 * 2026-10-13). Same words as the Agenda's visit window (VisitDetailsDialog).
 */
export function UnsavedNotesPrompt() {
  const router = useRouter();
  const [pending, setPending] = React.useState<{ proceed: () => void; cancel: () => void } | null>(null);
  const keepRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setUnsavedNotesPrompt((proceed, cancel) => setPending({ proceed, cancel }));
    return () => setUnsavedNotesPrompt(null);
  }, []);

  // Links anywhere on the page, the top bar included: caught before the app's own navigation.
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!hasUnsavedNotes() || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      const href = `${link.pathname}${link.search}${link.hash}`;
      leaveVisits(() => router.push(href));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  const keep = React.useCallback(() => {
    pending?.cancel();
    setPending(null);
  }, [pending]);

  React.useEffect(() => {
    if (!pending) return;
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") keep();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, keep]);

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/70 px-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Unsaved notes"
        data-testid="visits-unsaved-prompt"
        className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-800 px-4 py-4 shadow-2xl shadow-black/50"
      >
        <p className="text-sm text-slate-200">You have notes that are not saved yet.</p>
        <div className="mt-3 flex gap-2">
          <button
            ref={keepRef}
            type="button"
            onClick={keep}
            className="flex-1 rounded-xl border border-clinical-500/40 bg-clinical-500/10 px-3 py-2 text-xs font-semibold text-clinical-200 transition hover:bg-clinical-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/50"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              const { proceed } = pending;
              setPending(null);
              discardUnsavedNotes();
              proceed();
            }}
            className="flex-1 rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/50"
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  );
}
