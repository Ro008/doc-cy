"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const START_EVENT = "doccy:navigation-start";

type FinderFiltersProps = {
  districts: readonly string[];
  activeDistrict: string;
  activeSpecialty: string;
  activeName: string;
};

export function FinderFilters({
  districts,
  activeDistrict,
  activeSpecialty,
  activeName,
}: FinderFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [district, setDistrict] = React.useState(activeDistrict);
  const [specialty, setSpecialty] = React.useState(activeSpecialty);
  const [name, setName] = React.useState(activeName);
  const [pendingAction, setPendingAction] = React.useState<"apply" | "reset" | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingGuardRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingGuardRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameTypingGuardRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditingSpecialtyRef = React.useRef(false);
  const isEditingNameRef = React.useRef(false);

  React.useEffect(() => {
    // Keep district in sync with URL-driven state.
    setDistrict(activeDistrict);
    // Avoid clobbering keystrokes while user is actively typing.
    if (!isEditingSpecialtyRef.current) {
      setSpecialty(activeSpecialty);
    }
    if (!isEditingNameRef.current) {
      setName(activeName);
    }
    setPendingAction(null);
  }, [activeDistrict, activeSpecialty, activeName]);

  React.useEffect(() => {
    // Also clear pending when URL has updated, even if values happen to match previous state.
    setPendingAction(null);
  }, [pathname, searchParams]);

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
      if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
      if (typingGuardRef.current) clearTimeout(typingGuardRef.current);
      if (nameTypingGuardRef.current) clearTimeout(nameTypingGuardRef.current);
    };
  }, []);

  function pushFilters(nextDistrict: string, nextSpecialty: string, nextName: string) {
    const params = new URLSearchParams();
    if (nextDistrict) params.set("district", nextDistrict);
    if (nextSpecialty) params.set("specialty", nextSpecialty);
    if (nextName) params.set("name", nextName);
    const qs = params.toString();
    const target = qs ? `/finder?${qs}` : "/finder";
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
    if (!district && !specialty && !name) {
      setPendingAction(null);
      return;
    }
    setDistrict("");
    setSpecialty("");
    setName("");
    setPendingAction("reset");
    if (pendingGuardRef.current) clearTimeout(pendingGuardRef.current);
    pendingGuardRef.current = setTimeout(() => setPendingAction(null), 1500);
    pushFilters("", "", "");
  }

  const isPending = pendingAction !== null;
  const activeFilterEntries = [
    district ? `District: ${district}` : null,
    specialty.trim() ? `Specialty: ${specialty.trim()}` : null,
    name.trim() ? `Name: ${name.trim()}` : null,
  ].filter((item): item is string => Boolean(item));
  const hasActiveFilters = activeFilterEntries.length > 0;

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
      <form className="grid gap-3 sm:grid-cols-4">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        District
        <select
          name="district"
          value={district}
          onChange={(e) => {
            const nextDistrict = e.target.value;
            setDistrict(nextDistrict);
            applyFilters(nextDistrict, specialty.trim(), name.trim());
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
        <input
          name="specialty"
          type="text"
          value={specialty}
          onChange={(e) => {
            const nextSpecialty = e.target.value;
            setSpecialty(nextSpecialty);
            isEditingSpecialtyRef.current = true;
            if (typingGuardRef.current) clearTimeout(typingGuardRef.current);
            typingGuardRef.current = setTimeout(() => {
              isEditingSpecialtyRef.current = false;
            }, 900);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              applyFilters(district, nextSpecialty.trim(), name.trim(), { showPending: false });
            }, 350);
          }}
          placeholder="Start typing..."
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
      </label>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Name
        <input
          name="name"
          type="text"
          value={name}
          onChange={(e) => {
            const nextName = e.target.value;
            setName(nextName);
            isEditingNameRef.current = true;
            if (nameTypingGuardRef.current) clearTimeout(nameTypingGuardRef.current);
            nameTypingGuardRef.current = setTimeout(() => {
              isEditingNameRef.current = false;
            }, 900);
            if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
            nameDebounceRef.current = setTimeout(() => {
              applyFilters(district, specialty.trim(), nextName.trim(), { showPending: false });
            }, 350);
          }}
          placeholder="Search by name..."
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
      </label>
        <div className="flex items-end" />
      </form>
    </div>
  );
}
