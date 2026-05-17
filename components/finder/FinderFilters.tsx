"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  districtToSlug,
  slugToSpecialty,
  specialtyToSlug,
  toTitleCaseWords,
} from "@/lib/finder-seo";
import type { CyprusDistrict } from "@/lib/cyprus-districts";
import type { FinderSpecialtyOption } from "@/lib/finder-specialty-options";
import { Info, Search } from "lucide-react";
import { PendingLink } from "@/components/navigation/PendingLink";

const START_EVENT = "doccy:navigation-start";

type FinderFiltersProps = {
  districts: readonly string[];
  activeDistrict: string;
  activeSpecialty: string;
  activeName: string;
  specialtyOptions: readonly FinderSpecialtyOption[];
};

export function FinderFilters({
  districts,
  activeDistrict,
  activeSpecialty,
  activeName,
  specialtyOptions,
}: FinderFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [district, setDistrict] = React.useState(activeDistrict);
  const [specialtySlug, setSpecialtySlug] = React.useState(() =>
    activeSpecialty ? specialtyToSlug(activeSpecialty) : ""
  );
  const [name, setName] = React.useState(activeName);
  const [pendingAction, setPendingAction] = React.useState<"apply" | "reset" | "search" | null>(null);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const pendingGuardRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const mergedSpecialtyOptions = React.useMemo(() => {
    const slug = activeSpecialty ? specialtyToSlug(activeSpecialty) : "";
    if (!slug) return [...specialtyOptions];
    if (specialtyOptions.some((o) => o.slug === slug)) return [...specialtyOptions];
    return [
      ...specialtyOptions,
      { slug, label: toTitleCaseWords(slugToSpecialty(activeSpecialty)) },
    ].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [specialtyOptions, activeSpecialty]);

  React.useEffect(() => {
    // Keep district in sync with URL-driven state.
    setDistrict(activeDistrict);
    setSpecialtySlug(activeSpecialty ? specialtyToSlug(activeSpecialty) : "");
    setName(activeName);
    setPendingAction(null);
  }, [activeDistrict, activeSpecialty, activeName]);

  React.useEffect(() => {
    // Also clear pending when URL has updated, even if values happen to match previous state.
    setPendingAction(null);
    setIsNavigating(false);
  }, [pathname, searchParams]);

  React.useEffect(() => {
    function onStart() {
      setIsNavigating(true);
    }
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, []);

  React.useEffect(() => {
    return () => {
      if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    };
  }, []);

  function specialtyLabelFromSlug(slug: string): string {
    if (!slug) return "";
    return (
      mergedSpecialtyOptions.find((o) => o.slug === slug)?.label ?? slugToSpecialty(slug)
    );
  }

  function submitNameSearch() {
    setPendingAction("search");
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    window.dispatchEvent(new Event(START_EVENT));
    pushFilters(district, specialtyLabelFromSlug(specialtySlug), name.trim());
  }

  function pushFilters(nextDistrict: string, nextSpecialty: string, nextName: string) {
    const districtSlug = nextDistrict ? districtToSlug(nextDistrict as CyprusDistrict) : "all";
    const specialtyPathSegment = nextSpecialty ? specialtyToSlug(nextSpecialty) : "all";
    const params = new URLSearchParams();
    if (nextName) params.set("name", nextName);
    const finderPath =
      !nextDistrict && !nextSpecialty
        ? "/finder"
        : !nextSpecialty
          ? `/finder/${districtSlug}`
          : `/finder/${districtSlug}/${specialtyPathSegment}`;
    const qs = params.toString();
    const target = qs ? `${finderPath}?${qs}` : finderPath;
    if (`${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}` === target) {
      setPendingAction(null);
      return;
    }
    window.dispatchEvent(new Event(START_EVENT));
    router.push(target);
    router.refresh();
  }

  function applyFilters(
    nextDistrict: string,
    nextSpecialty: string,
    nextName: string,
    options?: { showPending?: boolean }
  ) {
    const showPending = options?.showPending ?? true;
    if (showPending) {
      setPendingAction("apply");
    }
    // Safety valve: never leave button text stuck if navigation is no-op or delayed.
    if (showPending) {
      if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
      pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    } else {
      setPendingAction(null);
    }
    pushFilters(nextDistrict, nextSpecialty, nextName);
  }

  async function resetFilters() {
    if (!district && !specialtySlug && !activeName) {
      setPendingAction(null);
      return;
    }
    setDistrict("");
    setSpecialtySlug("");
    setName("");
    setPendingAction("reset");
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    pushFilters("", "", "");
  }

  const isPending = pendingAction !== null;
  const specialtyFilterLabel = specialtySlug
    ? mergedSpecialtyOptions.find((o) => o.slug === specialtySlug)?.label ??
      toTitleCaseWords(slugToSpecialty(specialtySlug))
    : "";

  const activeFilterEntries = [
    district ? `District: ${district}` : null,
    specialtyFilterLabel ? `Specialty: ${specialtyFilterLabel}` : null,
    activeName.trim() ? `Name: ${activeName.trim()}` : null,
  ].filter((item): item is string => Boolean(item));
  const hasActiveFilters = activeFilterEntries.length > 0;
  const showPaphosUrgentCareNote = district === "Paphos";

  return (
    <div className="space-y-3">
      <div
        aria-hidden={!hasActiveFilters}
        className={`overflow-hidden transition-all duration-300 ease-out ${
          hasActiveFilters ? "max-h-40 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1"
        }`}
      >
        <div className="rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
              {activeFilterEntries.length} active filter{activeFilterEntries.length > 1 ? "s" : ""}
            </p>
            <button
              type="button"
              disabled={isPending && pendingAction !== "reset"}
              onClick={resetFilters}
              className="inline-flex items-center justify-center rounded-lg border border-emerald-300/60 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pendingAction === "reset" ? "Resetting..." : "Clear all filters"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeFilterEntries.map((entry) => (
              <span
                key={entry}
                className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-medium text-emerald-100"
              >
                {entry}
              </span>
            ))}
          </div>
        </div>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          submitNameSearch();
        }}
      >
      <fieldset
        disabled={isNavigating}
        aria-busy={isNavigating}
        className="contents disabled:cursor-not-allowed"
      >
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        District
        <select
          name="district"
          value={district}
          onChange={(e) => {
            const nextDistrict = e.target.value;
            setDistrict(nextDistrict);
            applyFilters(nextDistrict, specialtyLabelFromSlug(specialtySlug), activeName);
          }}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          <option value="">All districts</option>
          {districts.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Specialty
        <select
          name="specialty"
          value={specialtySlug}
          onChange={(e) => {
            const nextSlug = e.target.value;
            setSpecialtySlug(nextSlug);
            applyFilters(district, specialtyLabelFromSlug(nextSlug), activeName, {
              showPending: false,
            });
          }}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          <option value="">All specialties</option>
          {mergedSpecialtyOptions.map((opt) => (
            <option key={opt.slug} value={opt.slug}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <label
          htmlFor="finder-name-filter"
          className="text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          Name
        </label>
        <div className="relative mt-2">
          <input
            id="finder-name-filter"
            name="name"
            type="search"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Search by name..."
            enterKeyHint="search"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-2 pl-3 pr-11 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            disabled={isPending}
            aria-label={pendingAction === "search" ? "Searching by name" : "Search by name"}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-slate-600 bg-slate-800/90 text-slate-400 transition hover:border-slate-500 hover:bg-slate-700/90 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>
      </fieldset>
      </form>
      {showPaphosUrgentCareNote ? (
        <div
          role="note"
          className="flex gap-2.5 rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2.5 sm:px-3.5"
        >
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500"
            strokeWidth={2}
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-slate-400">
            Looking for urgent care in Paphos?{" "}
            <PendingLink
              href="/blog/emergency-room-paphos-gesy-faster-options"
              className="font-medium text-emerald-400/95 underline decoration-emerald-500/35 underline-offset-[3px] transition hover:text-emerald-300"
            >
              Read our guide on GESY specialists & private hospitals
            </PendingLink>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
