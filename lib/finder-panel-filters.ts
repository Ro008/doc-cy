import { canonicalLanguageLabel, isMasterLanguageLabel } from "@/lib/cyprus-languages";

/**
 * The Finder's filter panel (Finder G, step 3; user, 2026-10-15/16): Book online with
 * Today / Next 7 days / Any time, Accepts GeSY and languages, beside the name search.
 * Every filter lives in the URL so the server filters, the count follows and a search
 * can be shared.
 */

export type FinderWhen = "any" | "today" | "week";

export type FinderPanelFilters = {
  /** Only cards that book online at that clinic. */
  online: boolean;
  /** A free time today or in the next 7 days; implies `online`. */
  when: FinderWhen;
  gesy: boolean;
  /** Canonical labels ("Greek"); a card matches if she speaks any of them. */
  languages: string[];
};

/** The URL parameters the panel owns; a new search from the header keeps them. */
export const FINDER_PANEL_PARAM_KEYS = ["online", "when", "gesy", "lang"] as const;

/** Shown before "More languages". */
export const FINDER_PANEL_PRIMARY_LANGUAGES = ["Greek", "English", "Russian"] as const;

type ParamValue = string | string[] | undefined | null;

function first(value: ParamValue): string {
  return String((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

export function parseFinderPanelFilters(params: {
  online?: ParamValue;
  when?: ParamValue;
  gesy?: ParamValue;
  lang?: ParamValue;
}): FinderPanelFilters {
  const whenRaw = first(params.when);
  const when: FinderWhen = whenRaw === "today" || whenRaw === "week" ? whenRaw : "any";
  const languages: string[] = [];
  for (const part of first(params.lang).split(",")) {
    const label = canonicalLanguageLabel(part);
    if (label && isMasterLanguageLabel(label) && !languages.includes(label)) languages.push(label);
  }
  return {
    // Only online booking has times to show, so a time turns it on.
    online: first(params.online) === "1" || when !== "any",
    when,
    gesy: first(params.gesy) === "1",
    languages,
  };
}

export function finderPanelFilterParams(filters: FinderPanelFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.online) out.online = "1";
  if (filters.when !== "any") out.when = filters.when;
  if (filters.gesy) out.gesy = "1";
  if (filters.languages.length > 0) {
    out.lang = filters.languages.map((label) => label.toLowerCase()).join(",");
  }
  return out;
}

/** The name and the panel's filters as one string, to tell whether two loads match. */
export function finderPanelFilterKey(filters: FinderPanelFilters, name: string): string {
  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim());
  for (const [key, value] of Object.entries(finderPanelFilterParams(filters))) params.set(key, value);
  return params.toString();
}

export function hasFinderPanelFilters(filters: FinderPanelFilters): boolean {
  return filters.online || filters.when !== "any" || filters.gesy || filters.languages.length > 0;
}

/**
 * No unregistered listing can pass: they never book online and list no languages. The
 * Finder then skips loading them (thousands of rows) instead of loading and dropping them.
 */
export function finderPanelExcludesListings(filters: FinderPanelFilters): boolean {
  return filters.online || filters.languages.length > 0;
}

/** The number on the Filters button: each filter that is on counts once. */
export function finderPanelFilterCount(filters: FinderPanelFilters, name: string): number {
  return (
    (name.trim() ? 1 : 0) +
    (filters.online ? 1 : 0) +
    (filters.when !== "any" ? 1 : 0) +
    (filters.gesy ? 1 : 0) +
    (filters.languages.length > 0 ? 1 : 0)
  );
}

export function finderCardPassesPanelFilters(
  card: { hasOnlineBooking: boolean; isGesy: boolean; languages: readonly string[] },
  filters: FinderPanelFilters,
  options: { hasSlotWithinDays?: (days: number) => boolean } = {},
): boolean {
  if (filters.online && !card.hasOnlineBooking) return false;
  if (filters.gesy && !card.isGesy) return false;
  if (filters.languages.length > 0) {
    const spoken = new Set(card.languages.map((label) => canonicalLanguageLabel(label)));
    if (!filters.languages.some((label) => spoken.has(label))) return false;
  }
  if (filters.when !== "any") {
    const days = filters.when === "today" ? 1 : 7;
    if (!options.hasSlotWithinDays?.(days)) return false;
  }
  return true;
}

/** A free time in the calendar's first `dayCount` days (day 0 = today, Cyprus time). */
export function finderCalendarHasSlotWithin(
  days: readonly { slots: readonly unknown[] }[],
  dayCount: number,
): boolean {
  return days.slice(0, dayCount).some((day) => day.slots.length > 0);
}
