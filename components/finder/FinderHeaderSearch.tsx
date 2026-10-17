"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Search } from "lucide-react";
import { slugToSpecialty } from "@/lib/finder-seo";
import { finderResultsPath } from "@/lib/finder-public-path";
import {
  filterFinderSpecialtyOptions,
  resolveFinderSpecialtyDropdown,
  type FinderSpecialtyOption,
} from "@/lib/finder-specialty-options";
import { townToSlug, type CyprusTownOption } from "@/lib/cyprus-towns";
import { FinderPlacePicker } from "@/components/finder/FinderPlacePicker";
import { appendFinderNearMeParams, type FinderNearMeCoords } from "@/lib/finder-distance";
import { emitNavigationStart, NAVIGATION_START_EVENT } from "@/lib/doccy-navigation";
import { finderPlaceLabel } from "@/lib/finder-place-label";
import {
  FINDER_NAME_MIN_QUERY_LENGTH,
  normalizeFinderNameQuery,
  resolveFinderWhoSubmit,
  splitFinderMatch,
  type FinderNameSuggestion,
  type FinderWhoSubmit,
} from "@/lib/finder-who-search";

type FinderHeaderSearchProps = {
  districts: readonly string[];
  activeDistrict: string;
  activeSpecialty: string;
  /** A ?name= search: the field shows the name. */
  activeName: string;
  activeTown: string;
  activeLatitude: number | null;
  activeLongitude: number | null;
  specialtyOptions: readonly FinderSpecialtyOption[];
};

/** A row of the suggestions, in the order shown. */
type WhoRow =
  | { type: "specialty"; slug: string; label: string }
  | { type: "person"; person: FinderNameSuggestion }
  | { type: "name"; name: string };

const INPUT_ID = "finder-specialty-filter";
const LIST_ID = `${INPUT_ID}-listbox`;
const NAME_LOOKUP_DELAY_MS = 200;

const sectionTitleClass =
  "px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-site-ink-600";
const chipClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center bg-[#E3F4F6] text-[#0A6B72] [.doccy-profile[data-scheme=dark]_&]:bg-[#17335A] [.doccy-profile[data-scheme=dark]_&]:text-[#7FE6EB]";

function Highlighted({ label, query }: { label: string; query: string }) {
  const part = splitFinderMatch(label, query);
  return (
    <>
      {part.before}
      {part.hit ? <b className="font-bold">{part.hit}</b> : null}
      {part.after}
    </>
  );
}

/**
 * The Finder's search in the header (mockup R3; user, 2026-10-16): one "Specialty or name"
 * field, one District or town picker (Near me, districts, a town search) and Search, each
 * on one line. Typing suggests specialties first, then up to five professionals by name,
 * then a search for everyone with that name. The fields show what is searched.
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

  function specialtyLabelFromSlug(slug: string): string {
    if (!slug) return "";
    return dropdown.options.find((o) => o.slug === slug)?.label ?? slugToSpecialty(slug);
  }

  const activeWhoText = dropdown.selectedSlug
    ? specialtyLabelFromSlug(dropdown.selectedSlug)
    : activeName.trim();

  const [whoText, setWhoText] = React.useState(activeWhoText);
  /** The specialty picked from the list, while the field still shows its name. */
  const [pickedSlug, setPickedSlug] = React.useState(dropdown.selectedSlug);
  /** What the list filters on: empty right after a pick, so every specialty shows. */
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  /** -1 until the arrow keys move: Enter then searches what was typed. */
  const [highlight, setHighlight] = React.useState(-1);
  const [people, setPeople] = React.useState<FinderNameSuggestion[]>([]);
  const [district, setDistrict] = React.useState(activeDistrict);
  const [town, setTown] = React.useState(activeTown);
  const [nearMeCoords, setNearMeCoords] = React.useState<FinderNearMeCoords | null>(activeCoords);
  const [isLocating, setIsLocating] = React.useState(false);
  const [geolocationError, setGeolocationError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const pendingGuardRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const whoRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setWhoText(activeWhoText);
    setPickedSlug(dropdown.selectedSlug);
    setQuery("");
    setOpen(false);
    setDistrict(activeDistrict);
    setTown(activeTown);
    setNearMeCoords(activeCoords);
    setGeolocationError(null);
    setIsPending(false);
    if (activeCoords) setIsLocating(false);
  }, [activeDistrict, activeTown, activeCoords, dropdown.selectedSlug, activeWhoText]);

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

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!whoRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Professionals by name: one lookup per pause in typing, the last answer wins.
  const nameQuery = normalizeFinderNameQuery(query);
  React.useEffect(() => {
    if (!nameQuery) {
      setPeople([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/directory/professional-name-suggestions?q=${encodeURIComponent(nameQuery)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { suggestions?: FinderNameSuggestion[] } | null) => {
          setPeople(Array.isArray(body?.suggestions) ? body.suggestions : []);
        })
        .catch(() => {
          // Aborted by the next keystroke, or offline: the specialties still show.
        });
    }, NAME_LOOKUP_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [nameQuery]);

  const busy = isPending || isNavigating || isLocating;

  const placeLabel = finderPlaceLabel({
    district,
    town,
    nearMe: Boolean(nearMeCoords) && !district && !town,
  });
  const placeWords =
    placeLabel === "All of Cyprus" ? "" : placeLabel === "Near me" ? " near you" : ` in ${placeLabel}`;

  const specialtyRows = React.useMemo(
    () => filterFinderSpecialtyOptions(dropdown.options, query),
    [dropdown.options, query],
  );
  const typedName = query.trim().replace(/\s+/g, " ");
  const rows: WhoRow[] = [
    ...specialtyRows.map((option) => ({ type: "specialty" as const, slug: option.slug, label: option.label })),
    ...(nameQuery ? people.map((person) => ({ type: "person" as const, person })) : []),
    ...(typedName.length >= FINDER_NAME_MIN_QUERY_LENGTH ? [{ type: "name" as const, name: typedName }] : []),
  ];
  const peopleStart = specialtyRows.length;

  React.useEffect(() => {
    setHighlight(-1);
  }, [query, open]);

  function navigate(target: string, reason: "finder-results" | "finder-near-me", skipNavigationStart = false) {
    const currentHref = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    if (currentHref === target) {
      setIsPending(false);
      setIsLocating(false);
      return;
    }
    setIsPending(true);
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setIsPending(false), 1500);
    if (!skipNavigationStart) emitNavigationStart(undefined, reason);
    router.push(target);
  }

  /** What the field holds: the picked specialty, or what was typed. */
  function currentWho(): FinderWhoSubmit {
    if (pickedSlug && whoText.trim() === specialtyLabelFromSlug(pickedSlug)) {
      return { kind: "specialty", slug: pickedSlug };
    }
    return resolveFinderWhoSubmit(whoText, dropdown.options);
  }

  function go(next: {
    who: FinderWhoSubmit;
    district: string;
    town: string;
    coords: FinderNearMeCoords | null;
    skipNavigationStart?: boolean;
  }) {
    const params = new URLSearchParams();
    // One field: a name search drops the specialty, a specialty drops the name.
    if (next.who.kind === "name") params.set("name", next.who.name);
    if (next.town) params.set("town", townToSlug(next.town));
    if (next.coords) appendFinderNearMeParams(params, next.coords);
    const specialty = next.who.kind === "specialty" ? specialtyLabelFromSlug(next.who.slug) : "";
    const finderPath = finderResultsPath(next.district || null, specialty || null);
    const qs = params.toString();
    navigate(qs ? `${finderPath}?${qs}` : finderPath, next.coords ? "finder-near-me" : "finder-results", next.skipNavigationStart);
  }

  function submit() {
    if (busy) return;
    setOpen(false);
    const placeIsSet = Boolean(district || town);
    go({ who: currentWho(), district, town, coords: placeIsSet ? null : nearMeCoords });
  }

  function choose(row: WhoRow) {
    setOpen(false);
    setQuery("");
    if (row.type === "specialty") {
      setPickedSlug(row.slug);
      setWhoText(row.label);
      return;
    }
    if (row.type === "person") {
      setWhoText(row.person.name);
      emitNavigationStart(row.person.href, "profile");
      router.push(row.person.href);
      return;
    }
    setPickedSlug("");
    setWhoText(row.name);
    const placeIsSet = Boolean(district || town);
    go({ who: { kind: "name", name: row.name }, district, town, coords: placeIsSet ? null : nearMeCoords });
  }

  function pickTown(option: CyprusTownOption) {
    if (busy) return;
    setTown(option.name);
    setDistrict(option.district);
    setNearMeCoords(null);
    go({ who: currentWho(), district: option.district, town: option.name, coords: null });
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
    const who = currentWho();
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
        go({ who, district: "", town: "", coords, skipNavigationStart: true });
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

  const optionId = (index: number) => `${INPUT_ID}-option-${index}`;
  const rowClass = (index: number) =>
    `flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[15px] text-site-ink-900 ${
      highlight === index ? "bg-[#E3F4F6] [.doccy-profile[data-scheme=dark]_&]:bg-[#17335A]" : ""
    }`;

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
          className="flex flex-col items-stretch rounded-[22px] border border-[#D3E2E6] bg-[#F3F8F9] p-1 [.doccy-profile[data-scheme=dark]_&]:border-[#2A4370] [.doccy-profile[data-scheme=dark]_&]:bg-[#0B1D38] md:flex-row md:rounded-full"
        >
          <div ref={whoRef} className="relative min-w-0 md:flex-[1.25_1_0]">
            <label htmlFor={INPUT_ID} className="sr-only">
              Specialty or name
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#0A6B72] [.doccy-profile[data-scheme=dark]_&]:text-[#7FE6EB]"
              strokeWidth={2}
              aria-hidden
            />
            <input
              id={INPUT_ID}
              type="text"
              role="combobox"
              autoComplete="off"
              spellCheck={false}
              placeholder="Specialty or name"
              data-testid="finder-specialty-trigger"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={LIST_ID}
              aria-activedescendant={open && highlight >= 0 && rows[highlight] ? optionId(highlight) : undefined}
              value={whoText}
              disabled={busy}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onChange={(event) => {
                setWhoText(event.target.value);
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (!open) setOpen(true);
                  else if (rows.length > 0) setHighlight((h) => (h + 1) % rows.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (rows.length > 0) setHighlight((h) => (h <= 0 ? rows.length - 1 : h - 1));
                } else if (event.key === "Enter") {
                  // A row picked with the arrow keys is the answer; otherwise Search runs on the text.
                  if (open && highlight >= 0 && rows[highlight]) {
                    event.preventDefault();
                    choose(rows[highlight]);
                  }
                } else if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
              className="h-11 w-full rounded-full border-0 bg-transparent pl-10 pr-4 text-[15px] font-semibold text-site-ink-900 placeholder:font-medium placeholder:text-site-ink-500 focus:bg-site-white focus:outline-none focus:ring-2 focus:ring-[#0A6B72] [.doccy-profile[data-scheme=dark]_&]:focus:bg-[#11264A] [.doccy-profile[data-scheme=dark]_&]:focus:ring-[#12B8C0] md:h-[42px]"
            />

            {open ? (
              <div
                className="absolute left-0 top-full z-40 mt-2 w-full rounded-[18px] border border-site-ink-200 bg-site-white p-2 shadow-[0_18px_44px_rgba(11,34,54,0.18)] md:w-[440px]"
                role="presentation"
              >
                <ul id={LIST_ID} role="listbox" aria-label="Suggestions" className="max-h-[min(420px,60vh)] overflow-auto">
                  {specialtyRows.length > 0 ? (
                    <li role="presentation" className={sectionTitleClass}>
                      Specialties
                    </li>
                  ) : null}
                  {rows.map((row, index) => {
                    const common = {
                      id: optionId(index),
                      onMouseEnter: () => setHighlight(index),
                      onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
                      onClick: () => choose(row),
                    };
                    if (row.type === "specialty") {
                      return (
                        <li
                          key={`s-${row.slug}`}
                          {...common}
                          role="option"
                          aria-selected={highlight === index}
                          data-value={row.slug}
                          className={rowClass(index)}
                        >
                          <span className={`${chipClass} rounded-[10px]`} aria-hidden>
                            <Heart className="h-4 w-4" strokeWidth={2} />
                          </span>
                          <span className="min-w-0 truncate">
                            <Highlighted label={row.label} query={query} />
                          </span>
                        </li>
                      );
                    }
                    if (row.type === "person") {
                      return (
                        <React.Fragment key={`p-${row.person.id}`}>
                          {index === peopleStart ? (
                            <li role="presentation" className={`${sectionTitleClass} mt-1 border-t border-site-ink-100 pt-2.5`}>
                              Professionals
                            </li>
                          ) : null}
                          <li
                            {...common}
                            role="option"
                            aria-selected={highlight === index}
                            data-professional-href={row.person.href}
                            className={rowClass(index)}
                          >
                            {row.person.photoUrl ? (
                              <img
                                src={row.person.photoUrl}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className={`${chipClass} rounded-full text-xs font-extrabold`} aria-hidden>
                                {row.person.initials}
                              </span>
                            )}
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate">
                                <Highlighted label={row.person.name} query={query} />
                              </span>
                              {row.person.meta ? (
                                <span className="truncate text-[13px] text-site-ink-600">{row.person.meta}</span>
                              ) : null}
                            </span>
                          </li>
                        </React.Fragment>
                      );
                    }
                    return (
                      <li
                        key="name"
                        {...common}
                        role="option"
                        aria-selected={highlight === index}
                        data-testid="finder-who-name-search"
                        className={`${rowClass(index)} ${
                          index > 0 ? "mt-1 border-t border-site-ink-100" : ""
                        } text-sm font-semibold text-[#0A6B72] [.doccy-profile[data-scheme=dark]_&]:text-[#7FE6EB]`}
                      >
                        <Search className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                        <span className="min-w-0 truncate">
                          Every professional named “{row.name}”{placeWords}
                        </span>
                      </li>
                    );
                  })}
                  {rows.length === 0 ? (
                    <li role="presentation" className="px-2.5 py-2 text-sm text-site-ink-600">
                      No matching specialty
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
          <span aria-hidden className="my-2.5 hidden w-px shrink-0 bg-[#D3E2E6] [.doccy-profile[data-scheme=dark]_&]:bg-[#2A4370] md:block" />
          <FinderPlacePicker
            districts={districts}
            district={district}
            town={town}
            nearMe={Boolean(nearMeCoords) && !district && !town}
            locating={isLocating}
            disabled={busy}
            className="relative min-w-0 border-t border-[#D3E2E6] [.doccy-profile[data-scheme=dark]_&]:border-[#2A4370] md:flex-1 md:border-t-0"
            triggerClass="flex h-11 w-full items-center gap-2.5 rounded-full bg-transparent px-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clinical-300 disabled:cursor-not-allowed md:h-[42px]"
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
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ink-900 px-6 text-[15px] font-bold text-white transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 [.doccy-profile[data-scheme=dark]_&]:bg-clinical-500 [.doccy-profile[data-scheme=dark]_&]:text-[#062F61] [.doccy-profile[data-scheme=dark]_&]:hover:bg-clinical-400 md:h-[42px]"
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
