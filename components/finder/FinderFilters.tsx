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
  const [pendingAction, setPendingAction] = React.useState<"apply" | "reset" | null>(null);
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
    setDistrict(activeDistrict);
    setSpecialtySlug(activeSpecialty ? specialtyToSlug(activeSpecialty) : "");
    setName(activeName);
    setPendingAction(null);
  }, [activeDistrict, activeSpecialty, activeName]);

  React.useEffect(() => {
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

  function submitFilters() {
    setPendingAction("apply");
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    pushFilters(district, specialtyLabelFromSlug(specialtySlug), name.trim());
  }

  async function resetFilters() {
    if (!activeDistrict && !activeSpecialty && !activeName.trim()) {
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

  const activeFilterEntries = [
    activeDistrict ? `District: ${activeDistrict}` : null,
    activeSpecialty
      ? `Specialty: ${toTitleCaseWords(activeSpecialty)}`
      : null,
    activeName.trim() ? `Name: ${activeName.trim()}` : null,
  ].filter((item): item is string => Boolean(item));
  const hasActiveFilters = activeFilterEntries.length > 0;
  const showPaphosUrgentCareNote = district === "Paphos";

  return (
    <div className="relative space-y-4">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
        Search professionals
      </p>
      <div
        aria-hidden={!hasActiveFilters}
        className={`overflow-hidden transition-all duration-300 ease-out ${
          hasActiveFilters ? "max-h-40 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1"
        }`}
      >
        <div className="rounded-2xl border border-white/20 bg-slate-950/25 px-3 py-2 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
              {activeFilterEntries.length} active filter{activeFilterEntries.length > 1 ? "s" : ""}
            </p>
            <button
              type="button"
              disabled={isPending && pendingAction !== "reset"}
              onClick={resetFilters}
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pendingAction === "reset" ? "Resetting..." : "Clear all filters"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeFilterEntries.map((entry) => (
              <span
                key={entry}
                className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white"
              >
                {entry}
              </span>
            ))}
          </div>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitFilters();
        }}
      >
        <fieldset
          disabled={isNavigating}
          aria-busy={isNavigating}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)_auto] disabled:cursor-not-allowed"
        >
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-50/95">
              District
            </span>
            <select
              name="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="h-12 w-full rounded-full border-0 bg-white px-4 text-base font-medium text-slate-900 shadow-[0_4px_14px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="">All districts</option>
              {districts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-50/95">
              Specialty
            </span>
            <select
              name="specialty"
              value={specialtySlug}
              onChange={(e) => setSpecialtySlug(e.target.value)}
              className="h-12 w-full rounded-full border-0 bg-white px-4 text-base font-medium text-slate-900 shadow-[0_4px_14px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="">All specialties</option>
              {mergedSpecialtyOptions.map((opt) => (
                <option key={opt.slug} value={opt.slug}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label
            htmlFor="finder-name-filter"
            className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1"
          >
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-50/95">
              Name
            </span>
            <input
              id="finder-name-filter"
              name="name"
              type="search"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Search by name..."
              enterKeyHint="search"
              className="h-12 w-full rounded-full border-0 bg-white px-4 text-base font-medium text-slate-900 shadow-[0_4px_14px_rgba(0,0,0,0.12)] placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-1 lg:flex lg:items-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-12 w-full min-w-[11rem] items-center justify-center gap-2 rounded-full border-2 border-white/90 bg-emerald-400 px-6 text-sm font-bold uppercase tracking-[0.14em] text-slate-950 shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600/40 disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto"
            >
              <Search className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              {pendingAction === "apply" ? "Showing results..." : "Show results"}
            </button>
          </div>
        </fieldset>
      </form>
      {showPaphosUrgentCareNote ? (
        <div
          role="note"
          className="flex gap-2.5 rounded-2xl border border-white/15 bg-slate-950/30 px-3 py-2.5 backdrop-blur-sm sm:px-3.5"
        >
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-100/70"
            strokeWidth={2}
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-emerald-50/80">
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
