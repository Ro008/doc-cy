"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import {
  CYPRUS_SPOKEN_LANGUAGE_THEMES,
  CYPRUS_SPOKEN_LANGUAGE_LABELS,
  languageThemeForLabel,
} from "@/lib/cyprus-languages";

type Props = {
  id: string;
  /** FormData name for each selected value (multiple hidden inputs). */
  hiddenInputName?: string;
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  variant: "register" | "settings";
  /** Shown when nothing selected (register validation is server-side) */
  requiredHint?: boolean;
};

export function LanguageMultiSelect({
  id,
  hiddenInputName = "language",
  selected,
  onSelectedChange,
  variant,
  requiredHint,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = CYPRUS_SPOKEN_LANGUAGE_THEMES.filter((t) =>
    q ? t.label.toLowerCase().includes(q) : true
  );

  const selectedSet = new Set(selected);

  function toggle(label: string) {
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    const ordered = CYPRUS_SPOKEN_LANGUAGE_LABELS.filter((l) => next.has(l));
    onSelectedChange(ordered);
  }

  function remove(label: string) {
    onSelectedChange(selected.filter((l) => l !== label));
  }

  const triggerClass =
    variant === "register"
      ? "mt-1 flex w-full min-h-[42px] items-center justify-between gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-left text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      : "flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-left text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60";

  const listBoxClass =
    variant === "register"
      ? "absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-slate-700 bg-slate-900 py-1 shadow-xl"
      : "absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-800 bg-slate-950 py-1 shadow-xl";

  return (
    <div ref={rootRef} className="relative">
      {selected.map((lang) => (
        <input
          key={lang}
          type="hidden"
          name={hiddenInputName}
          value={lang}
          readOnly
        />
      ))}

      <label htmlFor={`${id}-trigger`} className="sr-only">
        Spoken languages
      </label>
      <button
        id={`${id}-trigger`}
        type="button"
        data-testid="language-multiselect-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
      >
        <span className="min-w-0 truncate text-left text-slate-200">
          {selected.length === 0 ? (
            <span className="text-slate-500">
              Select languages…
              {requiredHint ? (
                <span className="text-red-300"> *</span>
              ) : null}
            </span>
          ) : (
            <span className="text-slate-300">
              {selected.length} language{selected.length !== 1 ? "s" : ""} selected
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((lang) => {
            const theme = languageThemeForLabel(lang);
            return (
              <span
                key={lang}
                className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-semibold ${theme.pillClass}`}
              >
                {lang}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-black/20"
                  onClick={() => remove(lang)}
                  aria-label={`Remove ${lang}`}
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {open ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-multiselectable="true"
          className={listBoxClass}
        >
          <div className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/95 px-2 py-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search languages…"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                autoFocus
              />
            </div>
          </div>
          <ul className="py-1">
            {filtered.map((t) => {
              const checked = selectedSet.has(t.label);
              return (
                <li key={t.label}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    data-testid={`language-option-${t.label.replace(/\s+/g, "-")}`}
                    onClick={() => toggle(t.label)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/80"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                          : "border-slate-600 bg-slate-900"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.pillClass}`}
                    >
                      {t.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p
        className={
          variant === "register"
            ? "mt-1 text-[11px] text-slate-400"
            : "mt-1 text-xs text-slate-500"
        }
      >
        Choose all languages you consult in. Patients use this to find you.
      </p>
    </div>
  );
}
