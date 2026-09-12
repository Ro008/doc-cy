"use client";

import * as React from "react";
import { BriefcaseMedical, ChevronDown, Search } from "lucide-react";
import {
  filterFinderSpecialtyOptions,
  type FinderSpecialtyOption,
} from "@/lib/finder-specialty-options";

const ALL_SPECIALTIES_LABEL = "All specialties";

type FinderSpecialtyComboboxProps = {
  options: readonly FinderSpecialtyOption[];
  value: string;
  disabled?: boolean;
  onChange: (slug: string) => void;
  fieldClass: string;
  iconClass: string;
  inputId?: string;
};

export function FinderSpecialtyCombobox({
  options,
  value,
  disabled,
  onChange,
  fieldClass,
  iconClass,
  inputId = "finder-specialty-filter",
}: FinderSpecialtyComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const listId = `${inputId}-listbox`;

  const selectedLabel =
    value.trim().length > 0
      ? (options.find((option) => option.slug === value)?.label ?? value)
      : "";

  const filtered = React.useMemo(
    () => filterFinderSpecialtyOptions(options, query),
    [options, query],
  );

  /** Index 0 = All specialties; then filtered options. */
  const rowCount = 1 + filtered.length;

  React.useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(slug: string) {
    onChange(slug);
    setOpen(false);
    setQuery("");
  }

  function moveHighlight(delta: number) {
    setHighlight((current) => {
      if (rowCount <= 0) return 0;
      return (current + delta + rowCount) % rowCount;
    });
  }

  function commitHighlight() {
    if (highlight === 0) {
      choose("");
      return;
    }
    const option = filtered[highlight - 1];
    if (option) choose(option.slug);
  }

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1 basis-[22%]">
      <input type="hidden" name="specialty" value={value} readOnly />
      <label htmlFor={inputId} className="relative block">
        <span className="sr-only">Specialty</span>
        <BriefcaseMedical className={iconClass} strokeWidth={2} aria-hidden />
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          data-testid="finder-specialty-trigger"
          onClick={() => {
            if (disabled) return;
            setOpen((wasOpen) => {
              if (wasOpen) setQuery("");
              return !wasOpen;
            });
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(true);
            } else if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          className={`${fieldClass} text-left ${
            selectedLabel ? "text-ink-900" : "text-ink-400"
          }`}
        >
          <span className="block truncate">{selectedLabel || ALL_SPECIALTIES_LABEL}</span>
        </button>
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2}
          aria-hidden
        />
      </label>

      {open ? (
        <div
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm"
          role="presentation"
        >
          <div className="sticky top-0 border-b border-ink-100 bg-white p-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                disabled={disabled}
                placeholder="Search specialties…"
                aria-label="Search specialties"
                autoComplete="off"
                className="w-full rounded-lg border border-ink-200 bg-white py-1.5 pl-8 pr-2 text-xs font-medium text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clinical-200"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveHighlight(1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveHighlight(-1);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    commitHighlight();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                    setQuery("");
                  }
                }}
              />
            </div>
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label="Specialties"
            className="max-h-64 overflow-auto py-1"
          >
            <li role="option" aria-selected={value === ""} data-value="">
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm ${
                  highlight === 0
                    ? "bg-clinical-50 font-medium text-clinical-800"
                    : value === ""
                      ? "font-medium text-clinical-800"
                      : "text-ink-800 hover:bg-ink-50"
                }`}
                onMouseEnter={() => setHighlight(0)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose("")}
              >
                {ALL_SPECIALTIES_LABEL}
              </button>
            </li>
            {filtered.map((option, index) => {
              const rowIndex = index + 1;
              const selected = option.slug === value;
              const active = highlight === rowIndex;
              return (
                <li
                  key={option.slug}
                  role="option"
                  aria-selected={selected}
                  data-value={option.slug}
                >
                  <button
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm ${
                      active
                        ? "bg-clinical-50 font-medium text-clinical-800"
                        : selected
                          ? "font-medium text-clinical-800"
                          : "text-ink-800 hover:bg-ink-50"
                    }`}
                    onMouseEnter={() => setHighlight(rowIndex)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option.slug)}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-500" role="presentation">
                No matching specialty
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
