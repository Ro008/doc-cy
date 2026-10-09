"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  REGISTER_PHONE_PREFERRED_COUNTRIES,
  type RegisterPhoneCountry,
} from "@/lib/register-phone";

const PREFERRED = new Set<string>(REGISTER_PHONE_PREFERRED_COUNTRIES.map((code) => code.toUpperCase()));

/**
 * The mobile's country code on the dark settings cards (user, 2026-10-09). A native
 * select opens the system's white list, unreadable here and long (≈245 countries), so
 * this is a searchable list styled like the settings language picker: type a country,
 * its dial code ("+30") or its ISO code; arrows + Enter to pick, Escape to close.
 */
export function CountryCodePicker({
  countries,
  value,
  onChange,
  disabled = false,
}: {
  /** Preferred countries first (lib/register-phone.ts). */
  countries: readonly RegisterPhoneCountry[];
  /** ISO code, upper case ("CY"). */
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  const selected = countries.find((item) => item.code === value);

  const q = query.trim().toLowerCase();
  const digits = q.replace(/[^0-9]/g, "");
  const filtered = q
    ? countries.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase() === q ||
          (digits !== "" && item.dialCode.slice(1).startsWith(digits)),
      )
    : countries;

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted row in view while using the arrow keys.
  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, countries.findIndex((item) => item.code === value)));
    setOpen(true);
  };

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[active];
      if (item) pick(item.code);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Country code: ${selected?.name ?? value} ${selected?.dialCode ?? ""}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            openList();
          }
        }}
        className="flex items-center gap-1.5 rounded-l-xl border-r border-slate-700 pl-3 pr-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-slate-400">{value}</span>
        <span className="tabular-nums">{selected?.dialCode ?? ""}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
          <div className="border-b border-slate-800/80 p-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKey}
                placeholder="Search country or code…"
                aria-label="Search country or code"
                aria-controls={`${id}-list`}
                aria-activedescendant={filtered[active] ? `${id}-${filtered[active].code}` : undefined}
                autoFocus
                className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40"
              />
            </div>
          </div>
          <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label="Country code" className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500">No country matches.</li>
            ) : (
              filtered.map((item, index) => {
                const isSelected = item.code === value;
                // A thin line after the usual countries, only in the full list.
                const lastPreferred =
                  !q && PREFERRED.has(item.code) && !PREFERRED.has(filtered[index + 1]?.code ?? "");
                return (
                  <li
                    key={item.code}
                    id={`${id}-${item.code}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(item.code)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                      index === active ? "bg-slate-800/80 text-slate-50" : "text-slate-200"
                    } ${lastPreferred ? "border-b border-slate-800" : ""}`}
                  >
                    <span className="w-7 shrink-0 text-xs font-semibold text-slate-500">{item.code}</span>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-400">{item.dialCode}</span>
                    <Check
                      className={`h-3.5 w-3.5 shrink-0 text-clinical-300 ${isSelected ? "" : "invisible"}`}
                      aria-hidden
                    />
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
