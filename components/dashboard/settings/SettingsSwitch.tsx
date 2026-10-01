"use client";

import * as React from "react";

/** The settings switch (teal when on), a real role="switch" button. */
export function SettingsSwitch({
  checked,
  onChange,
  label,
  busy = false,
  tone = "teal",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  busy?: boolean;
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
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300 disabled:opacity-60 ${
        checked ? on : "bg-slate-600"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform duration-200 ease-out ${
          checked ? "translate-x-5 bg-ink-900" : "translate-x-0 bg-slate-50"
        }`}
      />
    </button>
  );
}
