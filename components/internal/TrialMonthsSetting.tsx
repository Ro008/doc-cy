"use client";

import { useState } from "react";

import { MAX_TRIAL_MONTHS } from "@/lib/pro-access";

type Props = {
  /** Null when the setting could not be loaded. */
  months: number | null;
  /** Founders change it; partners only see it. */
  canEdit: boolean;
};

/**
 * The free-trial length every new professional gets (`app_settings.trial_months`).
 * Changing it affects professionals who join afterwards, never existing ones.
 */
export function TrialMonthsSetting({ months: initial, canEdit }: Props) {
  const [months, setMonths] = useState<number | null>(initial);
  const [draft, setDraft] = useState(String(initial ?? ""));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/settings/trial-months", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: draft.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { months?: number; message?: string };
      if (!res.ok || typeof json.months !== "number") {
        setError(json.message ?? "Could not save the trial length.");
        return;
      }
      setMonths(json.months);
      setDraft(String(json.months));
      setEditing(false);
    } catch {
      setError("Could not save the trial length.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/20 p-3 text-xs text-slate-400">
      {months == null ? (
        <span>Free trial: could not be loaded.</span>
      ) : (
        <span className="text-slate-200">Free trial: {months} months</span>
      )}
      <span>for each new professional; existing professionals keep their own end date.</span>

      {canEdit && !editing ? (
        <button
          type="button"
          onClick={() => {
            setDraft(String(months ?? ""));
            setError(null);
            setEditing(true);
          }}
          className="rounded-lg border border-slate-700 px-2 py-1 text-slate-200 hover:border-clinical-500/60 hover:text-white"
        >
          Change
        </button>
      ) : null}

      {canEdit && editing ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="flex items-center gap-2">
            <span className="sr-only">Trial length in months</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_TRIAL_MONTHS}
              step={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              aria-label="Trial length in months"
            />
            <span>months</span>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-clinical-600 px-2 py-1 font-medium text-white hover:bg-clinical-500 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-2 py-1 text-slate-300 hover:text-white"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {error ? (
        <span role="alert" className="text-red-300">
          {error}
        </span>
      ) : null}
    </div>
  );
}
