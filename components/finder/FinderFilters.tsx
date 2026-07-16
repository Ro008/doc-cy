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
import { emitNavigationStart, getNavigationStartMessage, NAVIGATION_START_EVENT } from "@/lib/doccy-navigation";

type FinderFiltersProps = {
  districts: readonly string[];
  activeDistrict: string;
  activeSpecialty: string;
  activeName: string;
  activeLatitude: number | null;
  activeLongitude: number | null;
  specialtyOptions: readonly FinderSpecialtyOption[];
};

export function FinderFilters({
  districts,
  activeDistrict,
  activeSpecialty,
  activeName,
  activeLatitude,
  activeLongitude,
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
  const [nearMeCoords, setNearMeCoords] = React.useState<{
    latitude: number;
    longitude: number;
  } | null>(() =>
    activeLatitude !== null && activeLongitude !== null
      ? { latitude: activeLatitude, longitude: activeLongitude }
      : null,
  );
  const [isLocating, setIsLocating] = React.useState(false);
  const [geolocationError, setGeolocationError] = React.useState<string | null>(null);
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
    setNearMeCoords(
      activeLatitude !== null && activeLongitude !== null
        ? { latitude: activeLatitude, longitude: activeLongitude }
        : null,
    );
    setGeolocationError(null);
    setPendingAction(null);
    if (activeLatitude !== null && activeLongitude !== null) {
      setIsLocating(false);
    }
  }, [activeDistrict, activeSpecialty, activeName, activeLatitude, activeLongitude]);

  React.useEffect(() => {
    setPendingAction(null);
    setIsNavigating(false);
  }, [pathname, searchParams]);

  React.useEffect(() => {
    function onStart() {
      setIsNavigating(true);
    }
    window.addEventListener(NAVIGATION_START_EVENT, onStart);
    return () => window.removeEventListener(NAVIGATION_START_EVENT, onStart);
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

  function pushFilters(
    nextDistrict: string,
    nextSpecialty: string,
    nextName: string,
    nextCoords: { latitude: number; longitude: number } | null,
    options?: { skipNavigationStart?: boolean; navigationReason?: "finder-results" | "finder-near-me" },
  ) {
    const districtSlug = nextDistrict ? districtToSlug(nextDistrict as CyprusDistrict) : "all";
    const specialtyPathSegment = nextSpecialty ? specialtyToSlug(nextSpecialty) : "all";
    const params = new URLSearchParams();
    if (nextName) params.set("name", nextName);
    if (nextCoords) {
      params.set("lat", String(nextCoords.latitude));
      params.set("lon", String(nextCoords.longitude));
    }
    const finderPath =
      !nextDistrict && !nextSpecialty
        ? "/finder"
        : !nextSpecialty
          ? `/finder/${districtSlug}`
          : `/finder/${districtSlug}/${specialtyPathSegment}`;
    const qs = params.toString();
    const target = qs ? `${finderPath}?${qs}` : finderPath;
    const currentHref = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    if (currentHref === target) {
      setPendingAction(null);
      if (isLocating) setIsLocating(false);
      return;
    }
    if (!options?.skipNavigationStart) {
      emitNavigationStart(undefined, options?.navigationReason ?? "finder-results");
    }
    const pathChanged = pathname !== finderPath;
    // Clearing path filters (e.g. /finder/nicosia/dentistry → /finder) or query-only
    // filters should replace history. Avoid router.refresh() on path changes: on the
    // optional catch-all [[...filters]] it races soft navigation and can leave the
    // filtered URL in place (Clear all filters appears to do nothing).
    const shouldReplace =
      Boolean(searchParams?.toString()) && !qs ? true : pathChanged && finderPath === "/finder";
    if (shouldReplace) {
      router.replace(target);
    } else {
      router.push(target);
    }
    if (!pathChanged) {
      router.refresh();
    }
  }

  function submitFilters() {
    setPendingAction("apply");
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    pushFilters(district, specialtyLabelFromSlug(specialtySlug), name.trim(), nearMeCoords);
  }

  function resetFilters() {
    if (
      !activeDistrict &&
      !activeSpecialty &&
      !activeName.trim() &&
      activeLatitude === null &&
      activeLongitude === null
    ) {
      setPendingAction(null);
      return;
    }
    setDistrict("");
    setSpecialtySlug("");
    setName("");
    setNearMeCoords(null);
    setIsLocating(false);
    setGeolocationError(null);
    setPendingAction("reset");
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    // Always hard-clear to unfiltered finder via replace (no refresh race).
    emitNavigationStart(undefined, "finder-results");
    router.replace("/finder");
  }

  React.useEffect(() => {
    if (!isLocating) return;
    const timeout = setTimeout(() => setIsLocating(false), 15000);
    return () => clearTimeout(timeout);
  }, [isLocating]);

  function locateNearMeAndApply() {
    if (!navigator.geolocation) {
      setGeolocationError("Geolocation is not supported by your browser.");
      return;
    }
    setGeolocationError(null);
    setIsLocating(true);
    emitNavigationStart(undefined, "finder-near-me");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setNearMeCoords(coords);
        pushFilters(district, specialtyLabelFromSlug(specialtySlug), name.trim(), coords, {
          skipNavigationStart: true,
        });
      },
      (error) => {
        setIsLocating(false);
        const messageByCode: Record<number, string> = {
          1: "Location permission denied.",
          2: "Location unavailable right now.",
          3: "Location request timed out.",
        };
        setGeolocationError(messageByCode[error.code] ?? "Could not get your location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  const isPending = pendingAction !== null;
  const isNearMeBusy = isLocating;
  const isFilterFormBusy = isNavigating || isNearMeBusy;
  const nearMeBusyMessage = getNavigationStartMessage("finder-near-me");

  const activeFilterEntries = [
    activeDistrict ? `District: ${activeDistrict}` : null,
    activeSpecialty
      ? `Specialty: ${toTitleCaseWords(activeSpecialty)}`
      : null,
    activeName.trim() ? `Name: ${activeName.trim()}` : null,
    activeLatitude !== null && activeLongitude !== null ? "Near me: enabled" : null,
  ].filter((item): item is string => Boolean(item));
  const hasActiveFilters = activeFilterEntries.length > 0;
  const showPaphosUrgentCareNote = district === "Paphos";

  return (
    <div className="relative space-y-4">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clinical-700">
        Search professionals
      </p>
      <div
        aria-hidden={!hasActiveFilters}
        className={`overflow-hidden transition-all duration-300 ease-out ${
          hasActiveFilters ? "max-h-40 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1"
        }`}
      >
        <div className="rounded-2xl border border-clinical-200 bg-clinical-50 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clinical-800">
              {activeFilterEntries.length} active filter{activeFilterEntries.length > 1 ? "s" : ""}
            </p>
            <button
              type="button"
              disabled={isPending && pendingAction !== "reset"}
              onClick={resetFilters}
              className="inline-flex items-center justify-center rounded-full border border-clinical-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-clinical-700 transition hover:bg-clinical-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pendingAction === "reset" ? "Resetting..." : "Clear all filters"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeFilterEntries.map((entry) => (
              <span
                key={entry}
                className="inline-flex items-center rounded-full border border-clinical-200 bg-white px-2.5 py-1 text-[11px] font-medium text-clinical-800"
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
          disabled={isFilterFormBusy}
          aria-busy={isFilterFormBusy}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)_auto_auto] disabled:cursor-not-allowed"
        >
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-clinical-700">
              District
            </span>
            <select
              name="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="h-12 w-full rounded-full border border-ink-200 bg-white px-4 text-base font-medium text-ink-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-clinical-300"
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
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-clinical-700">
              Specialty
            </span>
            <select
              name="specialty"
              value={specialtySlug}
              onChange={(e) => setSpecialtySlug(e.target.value)}
              className="h-12 w-full rounded-full border border-ink-200 bg-white px-4 text-base font-medium text-ink-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-clinical-300"
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
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-clinical-700">
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
              className="h-12 w-full rounded-full border border-ink-200 bg-white px-4 text-base font-medium text-ink-900 shadow-sm placeholder:font-normal placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clinical-300"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-1 lg:flex lg:items-end">
            <button
              type="submit"
              disabled={isPending || isFilterFormBusy}
              className="inline-flex h-12 w-full min-w-[11rem] items-center justify-center gap-2 rounded-full bg-clinical-500 px-6 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-[0_4px_14px_rgba(11,123,181,0.25)] transition hover:bg-clinical-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto"
            >
              <Search className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              {pendingAction === "apply" ? "Showing results..." : "Show results"}
            </button>
          </div>
          <div className="sm:col-span-2 lg:col-span-1 lg:flex lg:items-end">
            <button
              type="button"
              onClick={locateNearMeAndApply}
              disabled={isPending || isFilterFormBusy}
              aria-busy={isNearMeBusy}
              aria-label={isNearMeBusy ? nearMeBusyMessage : undefined}
              className="inline-flex h-12 w-full min-w-[11rem] items-center justify-center gap-2 rounded-full border border-clinical-300 bg-white px-6 text-sm font-bold text-clinical-700 shadow-sm transition hover:border-clinical-400 hover:bg-clinical-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto"
            >
              {isNearMeBusy ? (
                <>
                  <span
                    aria-hidden
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-clinical-400 border-r-transparent"
                  />
                  <span className="font-semibold normal-case tracking-normal">
                    {nearMeBusyMessage}
                  </span>
                </>
              ) : (
                <span className="uppercase tracking-[0.08em]">📍 Doctor near me</span>
              )}
            </button>
          </div>
        </fieldset>
      </form>
      {geolocationError ? (
        <p className="text-xs font-medium text-amber-700" role="alert">
          {geolocationError}
        </p>
      ) : null}
      {showPaphosUrgentCareNote ? (
        <div
          role="note"
          className="flex gap-2.5 rounded-2xl border border-wellness-200 bg-wellness-50 px-3 py-2.5 sm:px-3.5"
        >
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-wellness-600"
            strokeWidth={2}
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-wellness-800">
            Looking for urgent care in Paphos?{" "}
            <PendingLink
              href="/blog/emergency-room-paphos-gesy-faster-options"
              className="font-medium text-clinical-600 underline decoration-clinical-300 underline-offset-[3px] transition hover:text-clinical-500"
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
