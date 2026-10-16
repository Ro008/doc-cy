"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { emitNavigationStart } from "@/lib/doccy-navigation";
import {
  FINDER_PANEL_PARAM_KEYS,
  finderPanelFilterCount,
  finderPanelFilterKey,
  finderPanelFilterParams,
  parseFinderPanelFilters,
  type FinderPanelFilters,
  type FinderWhen,
} from "@/lib/finder-panel-filters";

/** Folded or open on wide screens, remembered per browser (a convenience only). */
const WIDE_OPEN_KEY = "doccy_finder_filters_open";

const WHEN_OPTIONS: { value: FinderWhen; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "any", label: "Any time" },
];

/**
 * Wide enough for the 260 px column beside the 1216 px cards (the page widens to
 * 1564 px; user, 2026-10-16: the cards never give up width to the filters).
 */
const WIDE_QUERY = "(min-width: 1840px)";

const sectionTitleClass =
  "text-[11px] font-extrabold uppercase tracking-[0.08em] text-site-ink-600";

const pillOnClass =
  "bg-ink-900 text-white [.doccy-profile[data-scheme=dark]_&]:bg-clinical-500 [.doccy-profile[data-scheme=dark]_&]:text-[#062F61]";

/**
 * The Finder's filter panel (Finder G, step 3; user, 2026-10-15/16): it opens once a search
 * is on. On wide screens it is a sticky column beside the results that folds away; the
 * page widens for it, so the cards keep their full width either way. Narrower, it is a folded Filters box
 * above the results. Every change goes to the URL and the server
 * filters (lib/finder-panel-filters.ts).
 */
export function FinderFilterPanel({
  show,
  activeName,
  filters,
  serverFilterKey,
  children,
}: {
  /** False before any search: the results alone. */
  show: boolean;
  activeName: string;
  filters: FinderPanelFilters;
  /** finderPanelFilterKey() of what the server built this page for. */
  serverFilterKey: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [wideOpen, setWideOpen] = React.useState(true);
  const [narrowOpen, setNarrowOpen] = React.useState(false);
  const [isWide, setIsWide] = React.useState(false);
  const [name, setName] = React.useState(activeName);
  const count = finderPanelFilterCount(filters, activeName);

  React.useEffect(() => setName(activeName), [activeName]);

  // Next 14.2.0 keeps the page a tab first loaded under its bare path for 30 seconds,
  // whatever its filters: "Clear filters" back to /paphos then showed the filtered list.
  // Read the page again when it was built for other filters than the address has.
  const asked = React.useRef<string | null>(null);
  const current = finderPanelFilterKey(
    parseFinderPanelFilters({
      online: searchParams?.get("online"),
      when: searchParams?.get("when"),
      gesy: searchParams?.get("gesy"),
    }),
    searchParams?.get("name") ?? "",
  );
  React.useEffect(() => {
    if (current === serverFilterKey) {
      asked.current = null;
      return;
    }
    // Once per address: never a loop if the two keep disagreeing.
    if (asked.current === current) return;
    asked.current = current;
    router.refresh();
  }, [current, serverFilterKey, router]);

  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(WIDE_OPEN_KEY) === "0") setWideOpen(false);
    } catch {
      // Storage blocked: start open.
    }
    const query = window.matchMedia(WIDE_QUERY);
    const sync = () => setIsWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const open = isWide ? wideOpen : narrowOpen;

  function toggle() {
    if (!isWide) {
      setNarrowOpen((value) => !value);
      return;
    }
    const next = !wideOpen;
    setWideOpen(next);
    try {
      window.localStorage.setItem(WIDE_OPEN_KEY, next ? "1" : "0");
    } catch {
      // Not remembered; fine.
    }
  }

  function go(next: FinderPanelFilters, nextName: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("page");
    params.delete("name");
    params.delete("lang"); // the languages filter, removed (user, 2026-10-16)
    for (const key of FINDER_PANEL_PARAM_KEYS) params.delete(key);
    if (nextName.trim()) params.set("name", nextName.trim());
    for (const [key, value] of Object.entries(finderPanelFilterParams(next))) params.set(key, value);
    const qs = params.toString();
    const target = qs ? `${pathname}?${qs}` : pathname;
    const current = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    if (target === current) return;
    emitNavigationStart(undefined, "finder-results");
    router.push(target, { scroll: false });
  }

  function set(next: Partial<FinderPanelFilters>) {
    go({ ...filters, ...next }, activeName);
  }

  if (!show) return <>{children}</>;

  return (
    // Wide: G's grid, a 260 px Filters column beside the cards at their full width; the
    // page widens to fit it (user, 2026-10-16). The box sticks while the cards scroll.
    <div className="min-[1840px]:grid min-[1840px]:grid-cols-[260px_minmax(0,1fr)] min-[1840px]:items-start min-[1840px]:gap-x-6">
      <aside
        data-testid="finder-filter-panel"
        aria-label="Filters"
        className="mt-6 min-[1840px]:sticky min-[1840px]:top-4"
      >
        <div className="rounded-[20px] border border-site-ink-200 bg-site-white px-4 py-2.5 min-[1840px]:max-h-[calc(100vh-2rem)] min-[1840px]:overflow-y-auto">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="finder-filter-body"
            className="flex min-h-11 w-full items-center justify-between gap-2.5 text-left"
          >
            <span className="inline-flex items-center gap-2.5 text-base font-extrabold text-site-ink-900">
              <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
              Filters
              {count > 0 ? (
                <span className={`inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-extrabold ${pillOnClass}`}>
                  {count}
                </span>
              ) : null}
            </span>
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-site-ink-200 bg-site-ink-50 text-site-ink-900"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
          </button>

          <div
            id="finder-filter-body"
            className={`${narrowOpen ? "block" : "hidden"} ${wideOpen ? "min-[1840px]:block" : "min-[1840px]:hidden"} pb-2.5 pt-3`}
          >
            <form
              role="search"
              aria-label="Search by name"
              onSubmit={(event) => {
                event.preventDefault();
                go(filters, name);
              }}
            >
              <label htmlFor="finder-name-filter" className={sectionTitleClass}>
                Name
              </label>
              <div className="relative mt-2">
                <input
                  id="finder-name-filter"
                  type="search"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Professional's name"
                  autoComplete="off"
                  className="h-11 w-full rounded-xl border border-site-ink-200 bg-site-ink-50 pl-3 pr-11 text-[15px] text-site-ink-900 placeholder:text-site-ink-500 focus:outline-none focus:ring-2 focus:ring-clinical-200"
                />
                <button
                  type="submit"
                  aria-label="Search by name"
                  className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-site-clinical-700 hover:bg-site-clinical-50"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>

            <fieldset className="mt-5 border-t border-site-ink-200 pt-4">
              <legend className={`${sectionTitleClass} float-left w-full`}>Availability</legend>
              <div className="clear-both flex items-center justify-between gap-3 pt-2">
                <span id="finder-online-label" className="text-[15px] font-semibold text-site-ink-900">
                  Book online
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={filters.online}
                  aria-labelledby="finder-online-label"
                  onClick={() =>
                    set({ online: !filters.online, when: filters.online ? "any" : filters.when })
                  }
                  className={`relative inline-flex h-7 w-12 flex-none items-center rounded-full transition ${
                    filters.online ? pillOnClass : "bg-site-ink-100 border border-site-ink-200"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-5 w-5 rounded-full bg-[#FFFFFF] shadow transition-transform ${
                      filters.online ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div role="radiogroup" aria-label="When" className="mt-3 flex flex-wrap gap-2">
                {WHEN_OPTIONS.map((option) => {
                  const on = filters.when === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ when: option.value })}
                      className={`min-h-9 rounded-full px-3.5 text-sm font-semibold transition ${
                        on
                          ? pillOnClass
                          : "border border-site-ink-200 bg-site-white text-site-ink-800 hover:border-site-clinical-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[13px] text-site-ink-600">Times are for online booking.</p>
            </fieldset>

            <fieldset className="mt-5 border-t border-site-ink-200 pt-4">
              <legend className={`${sectionTitleClass} float-left w-full`}>Cover</legend>
              <label className="clear-both flex min-h-11 cursor-pointer items-center gap-3 pt-2 text-[15px] font-semibold text-site-ink-900">
                <input
                  type="checkbox"
                  checked={filters.gesy}
                  onChange={() => set({ gesy: !filters.gesy })}
                  className="h-5 w-5 rounded accent-clinical-600"
                />
                Accepts GeSY
              </label>
            </fieldset>

            {count > 0 ? (
              <button
                type="button"
                onClick={() => go({ online: false, when: "any", gesy: false }, "")}
                className="mt-4 min-h-10 text-sm font-semibold text-site-clinical-800 underline decoration-site-clinical-300 underline-offset-4 hover:decoration-current"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </aside>
      {children}
    </div>
  );
}
