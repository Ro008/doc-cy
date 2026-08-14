"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, LocateFixed, MapPin, Search } from "lucide-react";
import { clinicsResultsPath } from "@/lib/clinics-public-path";
import { appendFinderNearMeParams, type FinderNearMeCoords } from "@/lib/finder-distance";
import {
  districtForTown,
  resolveFinderTownSubmit,
  townToSlug,
  type CyprusTownOption,
} from "@/lib/cyprus-towns";
import { FinderTownCombobox } from "@/components/finder/FinderTownCombobox";
import {
  emitNavigationStart,
  getNavigationStartMessage,
  NAVIGATION_START_EVENT,
} from "@/lib/doccy-navigation";

type ClinicsFiltersProps = {
  districts: readonly string[];
  activeDistrict: string;
  activeName: string;
  activeTown: string;
  activeLatitude: number | null;
  activeLongitude: number | null;
};

export function ClinicsFilters({
  districts,
  activeDistrict,
  activeName,
  activeTown,
  activeLatitude,
  activeLongitude,
}: ClinicsFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [district, setDistrict] = React.useState(activeDistrict);
  const [name, setName] = React.useState(activeName);
  const [townQuery, setTownQuery] = React.useState(activeTown);
  const [nearMeCoords, setNearMeCoords] = React.useState<FinderNearMeCoords | null>(() =>
    activeLatitude !== null && activeLongitude !== null
      ? { latitude: activeLatitude, longitude: activeLongitude }
      : null,
  );
  const [isLocating, setIsLocating] = React.useState(false);
  const [geolocationError, setGeolocationError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<"apply" | "reset" | null>(null);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const pendingGuardRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setDistrict(activeDistrict);
    setName(activeName);
    setTownQuery(activeTown);
    setNearMeCoords(
      activeLatitude !== null && activeLongitude !== null
        ? {
            latitude: activeLatitude,
            longitude: activeLongitude,
            accuracyMeters: (() => {
              const acc = Number(searchParams?.get("acc") ?? "");
              return Number.isFinite(acc) && acc > 0 ? acc : null;
            })(),
          }
        : null,
    );
    setGeolocationError(null);
    setPendingAction(null);
    if (activeLatitude !== null && activeLongitude !== null) {
      setIsLocating(false);
    }
  }, [activeDistrict, activeName, activeTown, activeLatitude, activeLongitude]);

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

  function pushFilters(
    nextDistrict: string,
    nextName: string,
    nextCoords: FinderNearMeCoords | null,
    nextTownQuery: string,
    options?: { skipNavigationStart?: boolean; navigationReason?: "finder-results" | "clinics-near-me" },
  ) {
    const resolved = resolveFinderTownSubmit(nextDistrict, nextTownQuery);
    const params = new URLSearchParams();
    if (nextName) params.set("name", nextName);
    if (resolved.town) params.set("town", townToSlug(resolved.town));
    if (nextCoords) {
      appendFinderNearMeParams(params, nextCoords);
    }
    const clinicsPath = clinicsResultsPath(resolved.district || null);
    const qs = params.toString();
    const target = qs ? `${clinicsPath}?${qs}` : clinicsPath;
    const currentHref = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    if (currentHref === target) {
      setPendingAction(null);
      if (isLocating) setIsLocating(false);
      return;
    }
    if (!options?.skipNavigationStart) {
      emitNavigationStart(undefined, options?.navigationReason ?? "finder-results");
    }
    router.push(target);
  }

  function submitFilters() {
    if (pendingAction || isNavigating || isLocating) return;
    setPendingAction("apply");
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    const placeIsSet = Boolean(district.trim() || townQuery.trim());
    pushFilters(district, name.trim(), placeIsSet ? null : nearMeCoords, townQuery);
  }

  function resetFilters() {
    if (pendingAction || isNavigating || isLocating) return;
    if (
      !activeDistrict &&
      !activeName.trim() &&
      !activeTown &&
      activeLatitude === null &&
      activeLongitude === null
    ) {
      setPendingAction(null);
      return;
    }
    setDistrict("");
    setName("");
    setTownQuery("");
    setNearMeCoords(null);
    setIsLocating(false);
    setGeolocationError(null);
    setPendingAction("reset");
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    emitNavigationStart(undefined, "finder-results");
    router.push(clinicsResultsPath(null));
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
    emitNavigationStart(undefined, "clinics-near-me");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: FinderNearMeCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        };
        setNearMeCoords(coords);
        setDistrict("");
        setTownQuery("");
        pushFilters("", name.trim(), coords, "", {
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
        maximumAge: 0,
      },
    );
  }

  const isPending = pendingAction !== null;
  const isNearMeBusy = isLocating;
  const isFilterFormBusy = isNavigating || isNearMeBusy || isPending;
  const nearMeBusyMessage = getNavigationStartMessage("clinics-near-me");
  const nearMeActive = activeLatitude !== null && activeLongitude !== null;

  const townChip =
    activeTown && activeDistrict && activeTown === activeDistrict
      ? `${activeTown} (town)`
      : activeTown || null;
  const activeFilterEntries = [
    activeName.trim() || null,
    activeDistrict || null,
    townChip,
    nearMeActive ? "Near me" : null,
  ].filter((item): item is string => Boolean(item));
  const hasActiveFilters = activeFilterEntries.length > 0;

  const fieldClass =
    "h-11 w-full bg-transparent pl-10 pr-3 text-sm font-medium text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none";
  const iconClass =
    "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clinical-500";

  return (
    <div className="relative space-y-2.5">
      {hasActiveFilters ? (
        <div
          data-testid="clinics-active-filters"
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
          <div className="flex min-w-0 flex-1 flex-col overflow-visible rounded-2xl bg-white shadow-sm divide-y divide-ink-100 sm:flex-row sm:divide-x sm:divide-y-0">
            <label htmlFor="clinics-name-filter" className="relative min-w-0 flex-1 basis-[34%]">
              <span className="sr-only">Clinic name</span>
              <Building2 className={iconClass} strokeWidth={2} aria-hidden />
              <input
                id="clinics-name-filter"
                name="name"
                type="search"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Search by clinic name..."
                enterKeyHint="search"
                className={fieldClass}
              />
            </label>
            <div className="relative min-w-0 flex-1 basis-[33%]">
              <label className="relative block">
                <span className="sr-only">District</span>
                <MapPin className={iconClass} strokeWidth={2} aria-hidden />
                <select
                  name="district"
                  value={district}
                  onChange={(e) => {
                    const nextDistrict = e.target.value;
                    setDistrict(nextDistrict);
                    const townDistrict = districtForTown(townQuery);
                    if (nextDistrict && townDistrict && townDistrict !== nextDistrict) {
                      setTownQuery("");
                    }
                  }}
                  className={fieldClass}
                >
                  <option value="">All districts</option>
                  {districts.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <FinderTownCombobox
              value={townQuery}
              district={district}
              disabled={isFilterFormBusy}
              fieldClass={fieldClass}
              iconClass={iconClass}
              inputId="clinics-town-filter"
              onChange={setTownQuery}
              onSelectTown={(option: CyprusTownOption) => {
                if (pendingAction || isNavigating || isLocating) return;
                setTownQuery(option.name);
                setDistrict(option.district);
                setNearMeCoords(null);
                setPendingAction("apply");
                if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
                pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
                pushFilters(option.district, name.trim(), null, option.name);
              }}
            />
          </div>
          <button
            type="button"
            onClick={locateNearMeAndApply}
            disabled={isFilterFormBusy}
            aria-busy={isNearMeBusy}
            aria-label={isNearMeBusy ? nearMeBusyMessage : "Clinic near me"}
            className={`inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-clinical-600 disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto lg:min-w-[8.5rem] ${
              nearMeActive || isNearMeBusy
                ? "bg-clinical-500 text-white hover:bg-clinical-400"
                : "bg-white text-clinical-700 hover:bg-clinical-50"
            }`}
          >
            {isNearMeBusy ? (
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
              />
            ) : (
              <LocateFixed className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            )}
            <span>{isNearMeBusy ? "Locating…" : "Near me"}</span>
          </button>
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
    </div>
  );
}
