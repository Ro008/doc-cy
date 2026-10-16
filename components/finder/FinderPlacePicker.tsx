"use client";

import * as React from "react";
import { Check, ChevronDown, LocateFixed, MapPin, Search } from "lucide-react";
import { suggestFinderTowns, FINDER_TOWN_MIN_QUERY_LENGTH, type CyprusTownOption } from "@/lib/cyprus-towns";
import { finderPlaceLabel } from "@/lib/finder-place-label";

type FinderPlacePickerProps = {
  districts: readonly string[];
  district: string;
  town: string;
  nearMe: boolean;
  locating: boolean;
  disabled?: boolean;
  triggerClass: string;
  onPickDistrict: (district: string) => void;
  onPickTown: (option: CyprusTownOption) => void;
  onNearMe: () => void;
};

const rowClass =
  "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-[15px]";

/**
 * One "District or town" picker (canvas mockup E, in G): Near me, the districts, then a
 * town or village search. Picking a district fills the field; a town or Near me searches
 * at once, as before.
 */
export function FinderPlacePicker({
  districts,
  district,
  town,
  nearMe,
  locating,
  disabled,
  triggerClass,
  onPickDistrict,
  onPickTown,
  onNearMe,
}: FinderPlacePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const label = locating ? "Locating…" : finderPlaceLabel({ district, town, nearMe });
  const suggestions = React.useMemo(() => suggestFinderTowns(query, null), [query]);

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
  }

  const districtRow = (value: string, text: string) => {
    const selected = !nearMe && !town && district === value;
    return (
      <li key={value || "all"} role="option" aria-selected={selected}>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onPickDistrict(value);
            close();
          }}
          className={`${rowClass} ${
            selected
              ? "bg-site-clinical-50 font-semibold text-site-clinical-800"
              : "text-site-ink-800 hover:bg-site-ink-50"
          }`}
        >
          <span>{text}</span>
          {selected ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : null}
        </button>
      </li>
    );
  };

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1 basis-[180px]">
      <button
        id="finder-place-filter"
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="finder-place-listbox"
        data-testid="finder-place-trigger"
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className={triggerClass}
      >
        <MapPin className="h-[17px] w-[17px] shrink-0 text-site-clinical-700" strokeWidth={2} aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-site-ink-600">District or town</span>
          <span className="truncate text-[15px] font-bold text-site-ink-900">{label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-site-ink-500 transition ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 z-40 mt-2 sm:left-auto sm:right-0 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-site-ink-200 bg-site-white p-2.5 shadow-lg">
          <button
            type="button"
            onClick={() => {
              close();
              onNearMe();
            }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[15px] font-bold text-site-clinical-700 hover:bg-site-clinical-50"
          >
            <LocateFixed className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            Near me
          </button>
          <p className="px-3 pb-0.5 pt-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-site-ink-600">
            Districts
          </p>
          <ul id="finder-place-listbox" role="listbox" aria-label="Districts" className="flex flex-col">
            {districtRow("", "All of Cyprus")}
            {districts.map((item) => districtRow(item, item))}
          </ul>
          <label
            htmlFor="finder-town-filter"
            className="block px-3 pb-1 pt-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-site-ink-600"
          >
            Or a town or village
          </label>
          <div className="relative mx-0.5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-site-ink-500"
              aria-hidden
            />
            <input
              id="finder-town-filter"
              type="search"
              autoComplete="off"
              value={query}
              placeholder="Start typing a town"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && suggestions[0]) {
                  event.preventDefault();
                  onPickTown(suggestions[0]);
                  close();
                } else if (event.key === "Escape") {
                  close();
                }
              }}
              className="h-11 w-full rounded-xl border border-site-ink-200 bg-site-ink-50 pl-9 pr-3 text-[15px] text-site-ink-900 placeholder:text-site-ink-500 focus:outline-none focus:ring-2 focus:ring-clinical-200"
            />
          </div>
          {suggestions.length > 0 ? (
            <ul role="listbox" aria-label="Towns" className="mt-1 flex max-h-56 flex-col overflow-auto">
              {suggestions.map((option) => (
                <li key={`${option.district}-${option.name}`} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onPickTown(option);
                      close();
                    }}
                    className={`${rowClass} text-site-ink-800 hover:bg-site-ink-50`}
                  >
                    <span className="font-semibold text-site-ink-900">{option.name}</span>
                    <span className="text-[13px] text-site-ink-600">{option.district}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim().length >= FINDER_TOWN_MIN_QUERY_LENGTH ? (
            <p className="px-3 py-2 text-sm text-site-ink-600">No matching town</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
