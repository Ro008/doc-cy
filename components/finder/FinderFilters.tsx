"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  slugToSpecialty,
  specialtyToSlug,
  toTitleCaseWords,
} from "@/lib/finder-seo";
import { finderResultsPath } from "@/lib/finder-public-path";
import type { FinderSpecialtyOption } from "@/lib/finder-specialty-options";
import { BriefcaseMedical, Info, LocateFixed, MapPin, Search, UserRound } from "lucide-react";
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
    const params = new URLSearchParams();
    if (nextName) params.set("name", nextName);
    if (nextCoords) {
      params.set("lat", String(nextCoords.latitude));
      params.set("lon", String(nextCoords.longitude));
    }
    const finderPath = finderResultsPath(
      nextDistrict || null,
      nextSpecialty || null,
    );
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
    window.location.assign(target);
  }

  function submitFilters() {
    if (pendingAction || isNavigating || isLocating) return;
    setPendingAction("apply");
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    pushFilters(district, specialtyLabelFromSlug(specialtySlug), name.trim(), nearMeCoords);
  }

  function resetFilters() {
    if (pendingAction || isNavigating || isLocating) return;
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
    emitNavigationStart(undefined, "finder-results");
    window.location.assign("/");
  }

  React.useEffect(() => {
    if (!isLocating) return;
    const timeout = setTimeout(() => setIsLocating(false), 15000);
    return () => clearTimeout(timeout);
  }, [isLocating]);

  function locateNearMeAndApply() {
    if (pendingAction || isNavigating || isLocating) return;
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
  const isFilterFormBusy = isNavigating || isNearMeBusy || isPending;
  const nearMeBusyMessage = getNavigationStartMessage("finder-near-me");
  const nearMeActive = activeLatitude !== null && activeLongitude !== null;

  const activeFilterEntries = [
    activeName.trim() || null,
    activeSpecialty ? toTitleCaseWords(activeSpecialty) : null,
    activeDistrict || null,
    nearMeActive ? "Near me" : null,
  ].filter((item): item is string => Boolean(item));
  const hasActiveFilters = activeFilterEntries.length > 0;
  const showPaphosUrgentCareNote = district === "Paphos";

  const fieldClass =
    "h-11 w-full bg-transparent pl-10 pr-3 text-sm font-medium text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none";
  const iconClass =
    "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clinical-500";

  return (
    <div className="relative space-y-2.5">
      {hasActiveFilters ? (
        <div
          data-testid="finder-active-filters"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80"
        >
          <span className="sr-only">Active filters</span>
          {activeFilterEntries.map((entry) => (
            <span
              key={entry}
              className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/90"
            >
              {entry}
            </span>
          ))}
          <button
            type="button"
            disabled={isFilterFormBusy}
            onClick={resetFilters}
            className="text-xs font-semibold text-white/75 underline decoration-white/35 underline-offset-2 transition hover:text-white hover:decoration-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pendingAction === "reset" ? "Clearing…" : "Clear"}
          </button>
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitFilters();
        }}
      >
        <fieldset
          disabled={isFilterFormBusy}
          aria-busy={isFilterFormBusy}
          className="flex flex-col gap-2 disabled:cursor-not-allowed lg:flex-row lg:items-stretch lg:gap-2"
        >
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm divide-y divide-ink-100 sm:flex-row sm:divide-x sm:divide-y-0">
            <label htmlFor="finder-name-filter" className="relative min-w-0 flex-1 basis-[30%]">
              <span className="sr-only">Name</span>
              <UserRound className={iconClass} strokeWidth={2} aria-hidden />
              <input
                id="finder-name-filter"
                name="name"
                type="search"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Search by name..."
                enterKeyHint="search"
                className={fieldClass}
              />
            </label>
            <label className="relative min-w-0 flex-1 basis-[28%]">
              <span className="sr-only">Specialty</span>
              <BriefcaseMedical className={iconClass} strokeWidth={2} aria-hidden />
              <select
                name="specialty"
                value={specialtySlug}
                onChange={(e) => setSpecialtySlug(e.target.value)}
                className={fieldClass}
              >
                <option value="">All specialties</option>
                {mergedSpecialtyOptions.map((opt) => (
                  <option key={opt.slug} value={opt.slug}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="relative min-w-0 flex-[1.15] basis-[34%]">
              <label className="relative block">
                <span className="sr-only">District</span>
                <MapPin className={iconClass} strokeWidth={2} aria-hidden />
                <select
                  name="district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className={`${fieldClass} pr-[7.25rem]`}
                >
                  <option value="">All districts</option>
                  {districts.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={locateNearMeAndApply}
                disabled={isFilterFormBusy}
                aria-busy={isNearMeBusy}
                aria-label={isNearMeBusy ? nearMeBusyMessage : "Doctor near me"}
                className={`absolute right-1.5 top-1/2 z-10 inline-flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-70 ${
                  nearMeActive || isNearMeBusy
                    ? "bg-clinical-500 text-white shadow-sm shadow-clinical-500/25"
                    : "bg-ink-50 text-clinical-700 ring-1 ring-ink-200/80 hover:bg-clinical-50 hover:text-clinical-800 hover:ring-clinical-200"
                }`}
              >
                {isNearMeBusy ? (
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-90"
                  />
                ) : (
                  <LocateFixed className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                )}
                <span>{isNearMeBusy ? "Locating…" : "Near me"}</span>
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isFilterFormBusy}
            aria-label={pendingAction === "apply" ? "Showing results..." : "Find"}
            className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold uppercase tracking-[0.12em] text-clinical-700 shadow-sm transition hover:bg-clinical-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-clinical-600 disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto lg:min-w-[5.5rem]"
          >
            {pendingAction === "apply" ? (
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-clinical-400 border-r-transparent"
              />
            ) : (
              <Search className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            )}
            <span>Find</span>
          </button>
        </fieldset>
      </form>
      {geolocationError ? (
        <p className="text-xs font-medium text-amber-100" role="alert">
          {geolocationError}
        </p>
      ) : null}
      {showPaphosUrgentCareNote ? (
        <div
          role="note"
          className="flex gap-2.5 rounded-2xl border border-white/25 bg-white/10 px-3 py-2.5 sm:px-3.5"
        >
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/90"
            strokeWidth={2}
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-white/90">
            Looking for urgent care in Paphos?{" "}
            <PendingLink
              href="/blog/emergency-room-paphos-gesy-faster-options"
              className="font-medium text-white underline decoration-white/50 underline-offset-[3px] transition hover:decoration-white"
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
