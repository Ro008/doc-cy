"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

export type PillSelectOption = {
  value: string;
  label: string;
  /** Tailwind background class of a colour dot (a clinic's colour on the agenda). */
  swatch?: string;
};

const LIST_MAX_PX = 288;

const PILL =
  "inline-flex h-10 items-center gap-2 rounded-full border border-slate-700/80 bg-ink-900/70 px-3.5 text-sm text-slate-200 transition hover:border-clinical-500/50 hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/50";

/**
 * A filter dropdown in the Visits panel's style (user, 2026-10-12), replacing the browser's
 * default <select>: options can carry a colour dot, so a clinic is recognisable here as on the
 * cards. Still part of the GET form (a hidden input carries the value); picking an option
 * calls `onChange` once the new value is in the form, so the page can search right away.
 */
export function PillSelect({
  id,
  name,
  label,
  icon,
  value: initialValue,
  allLabel,
  options,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  allLabel: string;
  options: PillSelectOption[];
  onChange: () => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  // Open towards the left when the list would run off the right edge of the screen.
  const [alignRight, setAlignRight] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const changed = React.useRef(false);
  const listId = React.useId();

  const all: PillSelectOption[] = React.useMemo(() => [{ value: "", label: allLabel }, ...options], [allLabel, options]);
  const selected = all.find((o) => o.value === value) ?? all[0]!;
  const isActive = value !== "";

  // The hidden input has the new value after this render; then search.
  React.useEffect(() => {
    if (changed.current) {
      changed.current = false;
      onChange();
    }
  }, [value, onChange]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openList() {
    const rect = rootRef.current?.getBoundingClientRect();
    setAlignRight(Boolean(rect && rect.left + LIST_MAX_PX > window.innerWidth - 16));
    setActive(Math.max(0, all.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function pick(next: string) {
    setOpen(false);
    if (next !== value) {
      changed.current = true;
      setValue(next);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActive((i) => (e.key === "ArrowDown" ? Math.min(all.length - 1, i + 1) : Math.max(0, i - 1)));
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(all.length - 1);
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      pick(all[active]!.value);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        id={id}
        aria-label={`${label}: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`${PILL} max-w-full ${isActive ? "border-clinical-500/60 bg-clinical-500/10 text-clinical-100" : ""}`}
      >
        {selected.swatch ? (
          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${selected.swatch}`} />
        ) : (
          <span aria-hidden className={isActive ? "text-clinical-300" : "text-slate-500"}>
            {icon}
          </span>
        )}
        <span className="truncate">{selected.label}</span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          data-testid={`${id}-list`}
          className={`absolute z-30 mt-2 max-h-72 w-max min-w-full max-w-[min(18rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-white/10 bg-ink-900 p-1.5 shadow-2xl shadow-black/50 ${alignRight ? "right-0" : "left-0"}`}
        >
          {all.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value || "__all"}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                  i === active ? "bg-clinical-500/15 text-clinical-50" : "text-slate-200"
                } ${isSelected ? "font-semibold" : ""}`}
              >
                {o.swatch ? (
                  <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${o.swatch}`} />
                ) : (
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0" />
                )}
                <span className="flex-1 truncate">{o.label}</span>
                {isSelected ? <Check aria-hidden className="h-4 w-4 shrink-0 text-clinical-300" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
