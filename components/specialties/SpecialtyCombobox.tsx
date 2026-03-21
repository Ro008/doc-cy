"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  CYPRUS_MASTER_SPECIALTIES,
  SPECIALTY_OTHER_LABEL,
  isMasterSpecialty,
} from "@/lib/cyprus-specialties";

type Props = {
  /** For label association */
  id: string;
  /** Hidden input names (registration form uses defaults) */
  specialtyName?: string;
  fromMasterName?: string;
  initialSpecialty: string;
  /** When false, initial value is treated as custom "Other" text even if it accidentally matches a master string */
  initialIsApproved?: boolean;
  /** Visual variant */
  variant?: "settings" | "register";
  /** Settings form: keep parent in sync for JSON save (registration omits this). */
  onSelectionChange?: (payload: {
    specialty: string;
    fromMaster: boolean;
  }) => void;
};

export function SpecialtyCombobox({
  id,
  specialtyName = "specialty",
  fromMasterName = "specialtyFromMaster",
  initialSpecialty,
  initialIsApproved = true,
  variant = "settings",
  onSelectionChange,
}: Props) {
  const initialTrim = initialSpecialty.trim();
  const startsAsMaster =
    Boolean(initialTrim) &&
    initialIsApproved !== false &&
    isMasterSpecialty(initialTrim);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<"master" | "other">(() =>
    startsAsMaster ? "master" : initialTrim ? "other" : "master"
  );
  const [masterValue, setMasterValue] = React.useState(() =>
    startsAsMaster ? initialTrim : ""
  );
  const [otherText, setOtherText] = React.useState(() =>
    startsAsMaster || !initialTrim ? "" : initialTrim
  );

  const rootRef = React.useRef<HTMLDivElement>(null);

  const resolvedSpecialty =
    mode === "master" ? masterValue.trim() : otherText.trim();
  const fromMaster = mode === "master";

  React.useEffect(() => {
    onSelectionChange?.({
      specialty: resolvedSpecialty,
      fromMaster,
    });
  }, [resolvedSpecialty, fromMaster, onSelectionChange]);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filteredMasters = CYPRUS_MASTER_SPECIALTIES.filter((s) =>
    q ? s.toLowerCase().includes(q) : true
  );
  const showOther =
    !q ||
    SPECIALTY_OTHER_LABEL.toLowerCase().includes(q) ||
    "other".includes(q);

  const displayLabel =
    mode === "master" && masterValue
      ? masterValue
      : mode === "other"
        ? SPECIALTY_OTHER_LABEL
        : "Select specialty…";

  const inputBase =
    variant === "register"
      ? "mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      : "mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60";

  const listBoxClass =
    variant === "register"
      ? "absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-slate-700 bg-slate-900 py-1 shadow-xl"
      : "absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-800 bg-slate-950 py-1 shadow-xl";

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={specialtyName} value={resolvedSpecialty} readOnly />
      <input
        type="hidden"
        name={fromMasterName}
        value={fromMaster ? "1" : "0"}
        readOnly
      />

      <label htmlFor={`${id}-trigger`} className="sr-only">
        Specialty
      </label>
      <button
        id={`${id}-trigger`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 text-left ${inputBase}`}
      >
        <span className={mode === "master" && masterValue ? "" : "text-slate-500"}>
          {displayLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className={listBoxClass}>
          <div
            className={
              variant === "register"
                ? "sticky top-0 border-b border-slate-800 bg-slate-900 p-2"
                : "sticky top-0 border-b border-slate-800 bg-slate-950 p-2"
            }
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 py-1.5 pl-8 pr-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                autoFocus
              />
            </div>
          </div>
          <ul role="listbox" className="py-1">
            {filteredMasters.map((s) => (
              <li key={s} role="option" aria-selected={mode === "master" && masterValue === s}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-emerald-500/15 hover:text-emerald-100"
                  onClick={() => {
                    setMode("master");
                    setMasterValue(s);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
            {showOther ? (
              <li role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm font-medium text-amber-200/95 hover:bg-amber-500/10"
                  onClick={() => {
                    setMode("other");
                    setMasterValue("");
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {SPECIALTY_OTHER_LABEL}
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      )}

      {mode === "other" && (
        <div className="mt-3">
          <label
            htmlFor={`${id}-other`}
            className={
              variant === "register"
                ? "block text-sm font-medium text-slate-200"
                : "text-xs font-medium text-slate-400"
            }
          >
            Describe your specialty <span className="text-amber-300/90">*</span>
          </label>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Our team will review and may map it to a standard category.
          </p>
          <input
            id={`${id}-other`}
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            required
            maxLength={120}
            placeholder="e.g. Sports medicine, Clinical genetics…"
            className={inputBase}
          />
        </div>
      )}
    </div>
  );
}
