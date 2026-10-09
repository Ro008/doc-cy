"use client";

import * as React from "react";
import { BusySpinner } from "@/components/dashboard/settings/BusyLabel";

/** The settings switch (teal when on), a real role="switch" button. */
export function SettingsSwitch({
  checked,
  onChange,
  label,
  busy = false,
  disabled = false,
  tone = "teal",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** Waiting for the server: spinner in the thumb, cannot be flipped again. */
  busy?: boolean;
  /** Cannot be changed at all (no spinner). */
  disabled?: boolean;
  tone?: "teal" | "amber";
}) {
  const on = tone === "amber" ? "bg-amber-400" : "bg-clinical-500";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy}
      disabled={busy || disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300 disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress aria-busy:opacity-100 ${
        checked ? on : "bg-slate-600"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full shadow transition-transform duration-200 ease-out ${
          checked ? "translate-x-5 bg-ink-900 text-clinical-300" : "translate-x-0 bg-slate-50 text-slate-500"
        }`}
      >
        {busy ? <BusySpinner className="h-3 w-3" /> : null}
      </span>
    </button>
  );
}
