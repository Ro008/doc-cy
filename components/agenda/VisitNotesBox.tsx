"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { PROFESSIONAL_NOTES_HINT, PROFESSIONAL_NOTES_MAX } from "@/lib/professional-notes";

/**
 * Her private notes on a visit that has started (user, 2026-10-04). Never shown to the
 * patient; she sees them when the patient books again.
 */
export function VisitNotesBox({
  appointmentId,
  initialNotes,
  onSaved,
}: {
  appointmentId: string;
  initialNotes: string | null;
  onSaved: (notes: string | null) => void;
}) {
  const [notes, setNotes] = React.useState(initialNotes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fieldId = React.useId();
  const dirty = notes.trim() !== (initialNotes ?? "").trim();

  React.useEffect(() => {
    setNotes(initialNotes ?? "");
    setError(null);
  }, [appointmentId, initialNotes]);

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}/notes`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.message === "string" ? data.message : "Could not save your notes.");
        return;
      }
      onSaved((data as { notes?: string | null })?.notes ?? null);
      sonnerToast.success("Notes saved.");
    } catch {
      setError("Could not save your notes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2.5" data-testid="visit-notes">
      <label htmlFor={fieldId} className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Your notes
      </label>
      <textarea
        id={fieldId}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={PROFESSIONAL_NOTES_MAX}
        rows={3}
        disabled={saving}
        className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40"
      />
      <p className="mt-1 flex justify-between gap-2 text-[11px] text-slate-500">
        <span>{PROFESSIONAL_NOTES_HINT}</span>
        <span className="tabular-nums">
          {notes.trim().length}/{PROFESSIONAL_NOTES_MAX}
        </span>
      </p>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !dirty}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-clinical-500/40 bg-clinical-500/10 px-3 py-2 text-xs font-semibold text-clinical-200 transition hover:border-clinical-400/60 hover:bg-clinical-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        {saving ? "Saving…" : "Save notes"}
      </button>
      {error ? <p className="mt-1.5 text-xs text-amber-300">{error}</p> : null}
    </div>
  );
}
