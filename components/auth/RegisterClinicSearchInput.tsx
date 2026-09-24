"use client";

import * as React from "react";
import { Building2, Search } from "lucide-react";
import {
  REGISTER_CLINIC_SEARCH_MIN_QUERY,
  type ClinicSearchCandidate,
} from "@/lib/register-clinic-search";
import { registerInputClass } from "@/lib/register-ui";

const DEBOUNCE_MS = 250;

/**
 * Type-ahead over DocCy's clinics (same interaction as the finder town field):
 * type, pick with mouse or arrows + Enter. Searches name, address and town.
 */
export function RegisterClinicSearchInput({
  index,
  onSelect,
  onSearchGoogle,
}: {
  index: number;
  onSelect: (clinic: ClinicSearchCandidate) => void;
  onSearchGoogle: () => void;
}) {
  const testId = `register-clinic-search-${index}`;
  const listId = `${testId}-list`;
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ClinicSearchCandidate[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  const ready = query.trim().replace(/\s/g, "").length >= REGISTER_CLINIC_SEARCH_MIN_QUERY;

  React.useEffect(() => {
    if (!ready) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/register/clinic-search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const body = (await res.json()) as { results?: ClinicSearchCandidate[] };
        setResults(Array.isArray(body.results) ? body.results : []);
        setHighlight(0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, ready]);

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const choose = (clinic: ClinicSearchCandidate) => {
    setOpen(false);
    onSelect(clinic);
  };

  const showList = open && ready && !loading && results.length > 0;
  const showEmpty = open && ready && !loading && results.length === 0;

  return (
    <div ref={wrapRef} className="relative mt-1">
      <label className="relative block">
        <span className="sr-only">Search DocCy clinics</span>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <input
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          data-testid={testId}
          data-focus-target="true"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setHighlight((current) => (results.length ? (current + 1) % results.length : 0));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((current) =>
                results.length ? (current - 1 + results.length) % results.length : 0,
              );
            } else if (event.key === "Enter" && showList && results[highlight]) {
              event.preventDefault();
              choose(results[highlight]!);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Clinic name, street or town"
          className={`${registerInputClass} !mt-0 pl-10`}
        />
      </label>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-ink-100 bg-white py-1 shadow-lg"
        >
          {results.map((clinic, optionIndex) => (
            <li key={clinic.id} role="option" aria-selected={optionIndex === highlight}>
              <button
                type="button"
                data-testid={`${testId}-option`}
                data-clinic-name={clinic.name}
                onMouseEnter={() => setHighlight(optionIndex)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(clinic)}
                className={`flex w-full items-start gap-3 px-3 py-2.5 text-left ${
                  optionIndex === highlight ? "bg-clinical-50" : "hover:bg-ink-50"
                }`}
              >
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-clinical-700" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink-900">{clinic.name}</span>
                  <span className="block truncate text-xs text-ink-600">
                    {clinic.address}
                  </span>
                </span>
                {clinic.professionalCount > 1 ? (
                  <span className="shrink-0 rounded-full bg-clinical-100 px-2 py-0.5 text-[11px] font-bold text-clinical-900">
                    {clinic.professionalCount} professionals
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showEmpty ? (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-600 shadow-lg">
          No DocCy clinic matches.{" "}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onSearchGoogle}
            className="font-bold text-clinical-800 underline underline-offset-2"
          >
            Search Google Maps
          </button>
        </div>
      ) : null}
    </div>
  );
}
