"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { slugToSpecialty } from "@/lib/finder-seo";
import { finderResultsPath } from "@/lib/finder-public-path";
import {
  resolveFinderSpecialtyDropdown,
  type FinderSpecialtyOption,
} from "@/lib/finder-specialty-options";
import { townToSlug, type CyprusTownOption } from "@/lib/cyprus-towns";
import { FinderSpecialtyCombobox } from "@/components/finder/FinderSpecialtyCombobox";
import { FinderPlacePicker } from "@/components/finder/FinderPlacePicker";
import { appendFinderNearMeParams, type FinderNearMeCoords } from "@/lib/finder-distance";
import { emitNavigationStart, NAVIGATION_START_EVENT } from "@/lib/doccy-navigation";
import { FINDER_PANEL_PARAM_KEYS } from "@/lib/finder-panel-filters";

type FinderHeaderSearchProps = {
  districts: readonly string[];
  activeDistrict: string;
  activeSpecialty: string;
  /** Kept from a ?name= link until the filter panel brings the name field back (step 3). */
  activeName: string;
  activeTown: string;
  activeLatitude: number | null;
  activeLongitude: number | null;
  specialtyOptions: readonly FinderSpecialtyOption[];
};

const fieldClass =
  "flex h-12 w-full items-center gap-2 rounded-[22px] bg-transparent pl-10 pr-9 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clinical-300 disabled:cursor-not-allowed";
const placeTriggerClass =
  "flex h-12 w-full items-center gap-2 rounded-[22px] bg-transparent px-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clinical-300 disabled:cursor-not-allowed";
const iconClass =
  "pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-site-clinical-700";

/**
 * The Finder's search in the header (Finder G, step 2, user 2026-10-16): Specialty, one
 * District or town picker (Near me, districts, a town search) and Search. The fields show
 * what is searched, so there are no separate filter chips.
 */
export function FinderHeaderSearch({
  districts,
  activeDistrict,
  activeSpecialty,
  activeName,
  activeTown,
  activeLatitude,
  activeLongitude,
  specialtyOptions,
}: FinderHeaderSearchProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dropdown = React.useMemo(
    () => resolveFinderSpecialtyDropdown(specialtyOptions, activeSpecialty),
    [specialtyOptions, activeSpecialty],
  );
  const activeCoords = React.useMemo<FinderNearMeCoords | null>(
    () =>
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
    [activeLatitude, activeLongitude, searchParams],
  );
  const [specialtySlug, setSpecialtySlug] = React.useState(() => dropdown.selectedSlug);
  const [district, setDistrict] = React.useState(activeDistrict);
  const [town, setTown] = React.useState(activeTown);
  const [nearMeCoords, setNearMeCoords] = React.useState<FinderNearMeCoords | null>(activeCoords);
  const [isLocating, setIsLocating] = React.useState(false);
  const [geolocationError, setGeolocationError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const pendingGuardRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setSpecialtySlug(dropdown.selectedSlug);
    setDistrict(activeDistrict);
    setTown(activeTown);
    setNearMeCoords(activeCoords);
    setGeolocationError(null);
    setIsPending(false);
    if (activeCoords) setIsLocating(false);
  }, [activeDistrict, activeTown, activeCoords, dropdown.selectedSlug]);

  React.useEffect(() => {
    setIsPending(false);
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

  React.useEffect(() => {
    if (!isLocating) return;
    const timeout = setTimeout(() => setIsLocating(false), 15000);
    return () => clearTimeout(timeout);
  }, [isLocating]);

  const busy = isPending || isNavigating || isLocating;

  function specialtyLabelFromSlug(slug: string): string {
    if (!slug) return "";
    return dropdown.options.find((o) => o.slug === slug)?.label ?? slugToSpecialty(slug);
  }

  function go(next: {
    district: string;
    town: string;
    coords: FinderNearMeCoords | null;
    skipNavigationStart?: boolean;
  }) {
    const params = new URLSearchParams();
    if (activeName.trim()) params.set("name", activeName.trim());
    if (next.town) params.set("town", townToSlug(next.town));
    if (next.coords) appendFinderNearMeParams(params, next.coords);
    // The filter panel's choices stay on for the new search (Finder G, step 3).
    for (const key of FINDER_PANEL_PARAM_KEYS) {
      const value = searchParams?.get(key);
      if (value) params.set(key, value);
    }
    const finderPath = finderResultsPath(next.district || null, specialtyLabelFromSlug(specialtySlug) || null);
    const qs = params.toString();
    const target = qs ? `${finderPath}?${qs}` : finderPath;
    const currentHref = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    if (currentHref === target) {
      setIsPending(false);
      setIsLocating(false);
      return;
    }
    setIsPending(true);
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setIsPending(false), 1500);
    if (!next.skipNavigationStart) {
      emitNavigationStart(undefined, next.coords ? "finder-near-me" : "finder-results");
    }
    router.push(target);
  }

  function submit() {
    if (busy) return;
    const placeIsSet = Boolean(district || town);
    go({ district, town, coords: placeIsSet ? null : nearMeCoords });
  }

  function pickTown(option: CyprusTownOption) {
    if (busy) return;
    setTown(option.name);
    setDistrict(option.district);
    setNearMeCoords(null);
    go({ district: option.district, town: option.name, coords: null });
  }

  function locateNearMe() {
    if (busy) return;
    if (!navigator.geolocation) {
      setGeolocationError("Geolocation is not supported by your browser.");
      return;
    }
    setGeolocationError(null);
    setIsLocating(true);
    emitNavigationStart(undefined, "finder-near-me");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: FinderNearMeCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        };
        setNearMeCoords(coords);
        setDistrict("");
        setTown("");
        go({ district: "", town: "", coords, skipNavigationStart: true });
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  return (
    <div className="w-full">
      <form
        role="search"
        aria-label="Find a professional"
        data-testid="finder-header-search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <fieldset
          disabled={busy}
          aria-busy={busy}
          className="flex flex-wrap items-stretch gap-1 rounded-[26px] border border-site-ink-200 bg-site-ink-50 p-1"
        >
          <FinderSpecialtyCombobox
            options={dropdown.options}
            value={specialtySlug}
            disabled={busy}
            caption="Specialty"
            className="relative min-w-0 flex-1 basis-[180px]"
            fieldClass={fieldClass}
            iconClass={iconClass}
            onChange={setSpecialtySlug}
          />
          <FinderPlacePicker
            districts={districts}
            district={district}
            town={town}
            nearMe={Boolean(nearMeCoords) && !district && !town}
            locating={isLocating}
            disabled={busy}
            triggerClass={placeTriggerClass}
            onPickDistrict={(next) => {
              setDistrict(next);
              setTown("");
              setNearMeCoords(null);
            }}
            onPickTown={pickTown}
            onNearMe={locateNearMe}
          />
          <button
            type="submit"
            aria-label={isPending ? "Showing results..." : "Search"}
            className="inline-flex min-h-12 flex-[1_0_110px] items-center justify-center gap-2 rounded-[22px] bg-ink-900 px-6 text-[15px] font-bold text-white transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 [.doccy-profile[data-scheme=dark]_&]:bg-clinical-500 [.doccy-profile[data-scheme=dark]_&]:text-[#062F61] [.doccy-profile[data-scheme=dark]_&]:hover:bg-clinical-400"
          >
            {isPending ? (
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
              />
            ) : (
              <Search className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            )}
            <span>Search</span>
          </button>
        </fieldset>
      </form>
      {geolocationError ? (
        <p className="mt-2 text-xs font-medium text-amber-700 [.doccy-profile[data-scheme=dark]_&]:text-amber-300" role="alert">
          {geolocationError}
        </p>
      ) : null}
    </div>
  );
}
