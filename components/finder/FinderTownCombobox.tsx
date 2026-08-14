"use client";

import * as React from "react";
import { Home } from "lucide-react";
import {
  FINDER_TOWN_MIN_QUERY_LENGTH,
  suggestFinderTowns,
  type CyprusTownOption,
} from "@/lib/cyprus-towns";

type FinderTownComboboxProps = {
  value: string;
  district: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelectTown: (option: CyprusTownOption) => void;
  fieldClass: string;
  iconClass: string;
  inputId?: string;
};

export function FinderTownCombobox({
  value,
  district,
  disabled,
  onChange,
  onSelectTown,
  fieldClass,
  iconClass,
  inputId = "finder-town-filter",
}: FinderTownComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  const suggestions = React.useMemo(
    () => suggestFinderTowns(value, district || null),
    [value, district],
  );

  React.useEffect(() => {
    setHighlight(0);
  }, [value, district]);

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(option: CyprusTownOption) {
    onSelectTown(option);
    setOpen(false);
  }

  const showList = open && suggestions.length > 0;

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1 basis-[24%]">
      <label className="relative block">
        <span className="sr-only">Town</span>
        <Home className={iconClass} strokeWidth={2} aria-hidden />
        <input
          id={inputId}
          name="town"
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls="finder-town-suggestions"
          aria-autocomplete="list"
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setHighlight((current) =>
                suggestions.length === 0 ? 0 : (current + 1) % suggestions.length,
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setHighlight((current) =>
                suggestions.length === 0
                  ? 0
                  : (current - 1 + suggestions.length) % suggestions.length,
              );
            } else if (event.key === "Enter" && showList && suggestions[highlight]) {
              event.preventDefault();
              choose(suggestions[highlight]!);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Town..."
          className={fieldClass}
        />
      </label>
      {showList ? (
        <ul
          id="finder-town-suggestions"
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-ink-100 bg-white py-1 shadow-lg"
        >
          {suggestions.map((option, index) => {
            const label = district ? option.name : `${option.name} (${option.district})`;
            return (
              <li key={`${option.district}-${option.name}`} role="option" aria-selected={index === highlight}>
                <button
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    index === highlight
                      ? "bg-clinical-50 font-medium text-clinical-800"
                      : "text-ink-800 hover:bg-ink-50"
                  }`}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : value.trim().length >= FINDER_TOWN_MIN_QUERY_LENGTH && open ? (
        <p className="absolute z-30 mt-1 w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm text-ink-500 shadow-lg">
          No matching town
        </p>
      ) : null}
    </div>
  );
}
