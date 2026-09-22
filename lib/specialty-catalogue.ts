/**
 * Specialties catalogue (`specialties`) and each professional's specialties
 * (`professional_specialties`). The single read path for specialty labels,
 * filters and finder URLs (Point C).
 *
 * - A finder URL segment resolves to a catalogue row by slug. Legacy spellings
 *   (`dentistry`, `haematology`, `pediatrics`, ...) resolve through the harmonize
 *   aliases and are flagged so the page can 308 to the canonical URL.
 * - Labels are the approved join rows, ordered alphabetically (no primary).
 * - Reads go through the service role; the tables are not exposed to anon.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { unstable_cache } from "next/cache";

import { getCachedDirectoryPayload } from "@/lib/finder-directory-cache";
import { FINDER_DIRECTORY_CACHE_TAG } from "@/lib/finder-directory-cache-key";
import { slugToSpecialty, specialtyToSlug } from "@/lib/finder-seo";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";
import type { FinderSpecialtyOption } from "@/lib/finder-specialty-options";
import { fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";

export type CatalogueSpecialty = { id: string; name: string; slug: string };

export type ProfessionalSpecialtyLabel = { name: string; slug: string };

/** Embeds a professional's specialties (all of them) into a `professionals` select. */
export const SPECIALTY_LINKS_SELECT =
  "specialty_links:professional_specialties(is_approved, specialties(name, slug))";

/**
 * Inner-join embed used only to filter `professionals` by one specialty. Kept under
 * its own alias so the filter never trims `specialty_links`.
 */
export const SPECIALTY_FILTER_SELECT =
  "specialty_filter:professional_specialties!inner(specialty_id)";

/** Slugs left out of the finder dropdown (too generic); rows still list unfiltered. */
const EXCLUDED_FINDER_SPECIALTY_SLUGS = new Set(["medicine", "pharmacy", "laboratory"]);

type SpecialtyLinkRow = {
  is_approved?: boolean | null;
  specialties?: { name?: string | null; slug?: string | null } | null;
};

function cleanCatalogueRow(raw: unknown): CatalogueSpecialty | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const name = String(row.name ?? "").trim();
  const slug = String(row.slug ?? "").trim();
  if (!id || !name || !slug) return null;
  return { id, name, slug };
}

export type ResolvedCatalogueSpecialty = {
  specialty: CatalogueSpecialty;
  /** True when the input only matched through a legacy alias (redirect to the canonical slug). */
  isAlias: boolean;
};

/**
 * Finder URL segment, query value or label -> catalogue row.
 * Direct slug matches win; legacy spellings go through the harmonize aliases.
 */
export function findCatalogueSpecialty(
  catalogue: readonly CatalogueSpecialty[],
  raw: string | null | undefined,
): ResolvedCatalogueSpecialty | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const slug = specialtyToSlug(value);
  if (!slug || slug === "all") return null;

  const bySlug = new Map(catalogue.map((row) => [row.slug, row]));
  const direct = bySlug.get(slug);
  if (direct) return { specialty: direct, isAlias: false };

  for (const candidate of [slugToSpecialty(slug), value]) {
    const aliasSlug = specialtyToSlug(harmonizeFinderSpecialtyLabel(candidate));
    const aliased = bySlug.get(aliasSlug);
    if (aliased) return { specialty: aliased, isAlias: true };
  }
  return null;
}

/** Approved labels from a `SPECIALTY_LINKS_SELECT` embed, unique by slug, alphabetical. */
export function specialtiesFromLinks(links: unknown): ProfessionalSpecialtyLabel[] {
  if (!Array.isArray(links)) return [];
  const bySlug = new Map<string, ProfessionalSpecialtyLabel>();
  for (const link of links as SpecialtyLinkRow[]) {
    if (!link || link.is_approved === false) continue;
    const name = String(link.specialties?.name ?? "").trim();
    const slug = String(link.specialties?.slug ?? "").trim();
    if (!name || !slug || bySlug.has(slug)) continue;
    bySlug.set(slug, { name, slug });
  }
  return sortSpecialtyLabels([...bySlug.values()]);
}

/** Display names for a `professionals` row selected with `SPECIALTY_LINKS_SELECT`. */
export function specialtyNamesForRow(row: { specialty_links?: unknown }): string[] {
  return specialtiesFromLinks(row.specialty_links).map((label) => label.name);
}

export function sortSpecialtyLabels<T extends { name: string }>(labels: readonly T[]): T[] {
  return [...labels].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}

/**
 * The finder slug a label belongs under: its own slug, or the canonical one for a
 * legacy spelling (`Dentistry` -> `dentist`). Same rule as the middleware's 308.
 */
export function canonicalSpecialtySlug(label: string): string {
  return specialtyToSlug(harmonizeFinderSpecialtyLabel(label));
}

/**
 * Catalogue ids a finder filter on `activeSlug` matches: the row itself plus any
 * legacy-spelling rows that belong under it (Testing still has a few).
 */
export function catalogueIdsForFinderSlug(
  catalogue: readonly CatalogueSpecialty[],
  activeSlug: string,
): string[] {
  return catalogue
    .filter((row) => row.slug === activeSlug || canonicalSpecialtySlug(row.name) === activeSlug)
    .map((row) => row.id);
}

/** True when one of the row's specialties is (or is a legacy spelling of) the active filter. */
export function hasSpecialtySlug(
  labels: readonly Pick<ProfessionalSpecialtyLabel, "name">[],
  activeSlug: string | null | undefined,
): boolean {
  if (!activeSlug) return true;
  return labels.some((label) => canonicalSpecialtySlug(label.name) === activeSlug);
}

/**
 * Finder dropdown: canonical catalogue rows with at least one visible professional
 * (`availableSpecialtyIds`, legacy-spelling rows counting for their canonical one),
 * minus the generic ones. Alphabetical.
 */
export function finderSpecialtyOptionsFromCatalogue(
  catalogue: readonly CatalogueSpecialty[],
  availableSpecialtyIds: ReadonlySet<string>,
): FinderSpecialtyOption[] {
  const availableSlugs = new Set(
    catalogue
      .filter((row) => availableSpecialtyIds.has(row.id))
      .map((row) => canonicalSpecialtySlug(row.name)),
  );
  return sortSpecialtyLabels(
    catalogue.filter(
      (row) =>
        canonicalSpecialtySlug(row.name) === row.slug &&
        availableSlugs.has(row.slug) &&
        !EXCLUDED_FINDER_SPECIALTY_SLUGS.has(row.slug),
    ),
  ).map((row) => ({ slug: row.slug, label: row.name }));
}

// ---------------------------------------------------------------------------
// Loaders (service role, cached with the finder directory).
// ---------------------------------------------------------------------------

export async function loadSpecialtyCatalogue(
  supabase: SupabaseClient,
): Promise<CatalogueSpecialty[]> {
  return getCachedDirectoryPayload(["specialty-catalogue"], async () => {
    const res = await supabase.from("specialties").select("id, name, slug").order("name");
    if (res.error) throw new Error(`specialty catalogue: ${res.error.message}`);
    return (res.data ?? [])
      .map(cleanCatalogueRow)
      .filter((row): row is CatalogueSpecialty => row !== null);
  });
}

/**
 * Catalogue names for the register / settings / founder comboboxes and for
 * validating what they submit: canonical rows only (a legacy spelling such as
 * `Dentistry` is not offered), minus the generic ones the finder also hides.
 *
 * Not cached: a label founders just approved must be offered straight away, and
 * these pages are low-traffic. The table is small (under 100 rows).
 */
export async function loadSpecialtyCatalogueNames(
  supabase: SupabaseClient,
): Promise<string[]> {
  const res = await supabase.from("specialties").select("id, name, slug").order("name");
  if (res.error) throw new Error(`specialty catalogue: ${res.error.message}`);
  return catalogueNamesForForms(
    (res.data ?? [])
      .map(cleanCatalogueRow)
      .filter((row): row is CatalogueSpecialty => row !== null),
  );
}

export function catalogueNamesForForms(catalogue: readonly CatalogueSpecialty[]): string[] {
  return sortSpecialtyLabels(
    catalogue.filter(
      (row) =>
        canonicalSpecialtySlug(row.name) === row.slug &&
        !EXCLUDED_FINDER_SPECIALTY_SLUGS.has(row.slug),
    ),
  ).map((row) => row.name);
}

/** Scraped listings only change when the GeSY import runs. */
const SCRAPED_AVAILABILITY_REVALIDATE_SECONDS = 600;

/**
 * Specialty ids with at least one visible scraped listing (active, `finder_visible`)
 * in `district` (all districts when empty).
 *
 * Always cached, including when integration runs bypass the finder cache: the query
 * costs ~150-650ms on the Testing instance, and running it on every finder request
 * timed out under CI load. Registered professionals, which do change mid-run, are
 * added per request from the rows the finder already loads
 * (`catalogueIdsForSpecialtyNames`).
 */
export async function loadScrapedAvailableSpecialtyIds(
  supabase: SupabaseClient,
  district: string,
): Promise<Set<string>> {
  const load = async () => {
    // One row per specialty with a matching listing (nested !inner), capped at one
    // child, instead of paging through every join row.
    const pro = "professional_specialties.professionals";
    let q = supabase
      .from("specialties")
      .select("id, professional_specialties!inner(id, professionals!inner(id))")
      .eq("professional_specialties.is_approved", true)
      .eq(`${pro}.is_archived`, false)
      .eq(`${pro}.is_registered`, false)
      .eq(`${pro}.finder_visible`, true);
    if (district) q = q.eq(`${pro}.district`, district);
    const res = await q.limit(1, { referencedTable: "professional_specialties" });
    if (res.error) throw new Error(`specialty availability: ${res.error.message}`);
    return (res.data ?? [])
      .map((row) => String((row as { id?: string }).id ?? "").trim())
      .filter(Boolean);
  };
  const ids = await unstable_cache(
    load,
    [FINDER_DIRECTORY_CACHE_TAG, "specialty-available-scraped", district || "all"],
    { revalidate: SCRAPED_AVAILABILITY_REVALIDATE_SECONDS, tags: [FINDER_DIRECTORY_CACHE_TAG] },
  )();
  return new Set(ids);
}

/** Catalogue ids for display names (e.g. registered rows' labels), legacy spellings included. */
export function catalogueIdsForSpecialtyNames(
  catalogue: readonly CatalogueSpecialty[],
  names: Iterable<string>,
): Set<string> {
  const out = new Set<string>();
  for (const name of names) {
    for (const id of catalogueIdsForFinderSlug(catalogue, canonicalSpecialtySlug(name))) {
      out.add(id);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Every specialty row of a professional, pending ones included (account, founder
// and email paths). Pending custom labels have no catalogue row yet, so their name
// is the submitted text.
// ---------------------------------------------------------------------------

/** Embeds all of a professional's specialty rows into a `professionals` select. */
export const SPECIALTY_ROWS_SELECT =
  "specialty_rows:professional_specialties(id, specialty, license_number, is_approved, created_at, specialties(name, slug))";

const SPECIALTY_ROW_COLUMNS =
  "id, professional_id, specialty, license_number, is_approved, created_at, specialties(name, slug)";

export type ProfessionalSpecialtyEntry = {
  /** `professional_specialties.id` */
  id: string;
  name: string;
  /** Null while a custom label is pending (no catalogue row). */
  slug: string | null;
  licenseNumber: string | null;
  isApproved: boolean;
};

type SpecialtyEntryRow = {
  id?: string | null;
  specialty?: string | null;
  license_number?: string | null;
  is_approved?: boolean | null;
  specialties?: { name?: string | null; slug?: string | null } | null;
};

/** Rows from `SPECIALTY_ROWS_SELECT` (or `professional_specialties`), alphabetical. */
export function specialtyEntriesFromRows(rows: unknown): ProfessionalSpecialtyEntry[] {
  if (!Array.isArray(rows)) return [];
  const entries: ProfessionalSpecialtyEntry[] = [];
  for (const row of rows as SpecialtyEntryRow[]) {
    if (!row) continue;
    const name = String(row.specialties?.name ?? row.specialty ?? "").trim();
    if (!name) continue;
    entries.push({
      id: String(row.id ?? ""),
      name,
      slug: String(row.specialties?.slug ?? "").trim() || null,
      licenseNumber: String(row.license_number ?? "").trim() || null,
      isApproved: row.is_approved !== false,
    });
  }
  return sortSpecialtyLabels(entries);
}

/** True while a custom specialty awaits founder review (was `is_specialty_approved = false`). */
export function hasPendingSpecialty(entries: readonly ProfessionalSpecialtyEntry[]): boolean {
  return entries.some((entry) => !entry.isApproved);
}

/**
 * The one specialty shown where a single label fits (emails, calendar events, account
 * screens): the first approved one alphabetically, else the first pending one. Same
 * rule the old sync trigger used for `professionals.specialty` (dropped in Point C3).
 */
export function primarySpecialtyEntry(
  entries: readonly ProfessionalSpecialtyEntry[],
): ProfessionalSpecialtyEntry | null {
  return entries.find((entry) => entry.isApproved) ?? entries[0] ?? null;
}

/** Approved names, alphabetical. */
export function approvedSpecialtyNames(entries: readonly ProfessionalSpecialtyEntry[]): string[] {
  return entries.filter((entry) => entry.isApproved).map((entry) => entry.name);
}

/** professional id -> all specialty rows (pending included), alphabetical. */
export async function loadSpecialtyEntriesByProfessionalIds(
  supabase: SupabaseClient,
  professionalIds: readonly string[],
): Promise<Map<string, ProfessionalSpecialtyEntry[]>> {
  const out = new Map<string, ProfessionalSpecialtyEntry[]>();
  const ids = [...new Set(professionalIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (ids.length === 0) return out;
  const res = await fetchAllSupabaseRowsForIdChunks(ids, (chunk) =>
    supabase
      .from("professional_specialties")
      .select(SPECIALTY_ROW_COLUMNS)
      .in("professional_id", chunk)
      .order("id"),
  );
  if (res.error) throw new Error(`professional specialties: ${res.error.message}`);
  const rowsById = new Map<string, unknown[]>();
  for (const row of res.data ?? []) {
    const id = String((row as { professional_id?: string }).professional_id ?? "");
    const list = rowsById.get(id) ?? [];
    list.push(row);
    rowsById.set(id, list);
  }
  for (const [id, rows] of rowsById) out.set(id, specialtyEntriesFromRows(rows));
  return out;
}

/** One professional's specialty rows (pending included), alphabetical. */
export async function loadSpecialtyEntries(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<ProfessionalSpecialtyEntry[]> {
  const map = await loadSpecialtyEntriesByProfessionalIds(supabase, [professionalId]);
  return map.get(professionalId) ?? [];
}

/**
 * The single label for emails and calendar events (see `primarySpecialtyEntry`).
 * Pass the service-role client: the tables have no RLS policies for users.
 */
export async function loadPrimarySpecialtyName(
  supabase: SupabaseClient,
  professionalId: string | null | undefined,
): Promise<string | null> {
  const id = String(professionalId ?? "").trim();
  if (!id) return null;
  return primarySpecialtyEntry(await loadSpecialtyEntries(supabase, id))?.name ?? null;
}

/** professional id -> approved labels, for rows loaded without the embed. */
export async function loadSpecialtiesByProfessionalIds(
  supabase: SupabaseClient,
  professionalIds: readonly string[],
): Promise<Map<string, ProfessionalSpecialtyLabel[]>> {
  const out = new Map<string, ProfessionalSpecialtyLabel[]>();
  const ids = [...new Set(professionalIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (ids.length === 0) return out;
  const res = await fetchAllSupabaseRowsForIdChunks(ids, (chunk) =>
    supabase
      .from("professional_specialties")
      .select("professional_id, is_approved, specialties(name, slug)")
      .in("professional_id", chunk)
      .order("id"),
  );
  if (res.error) throw new Error(`professional specialties: ${res.error.message}`);
  const linksById = new Map<string, SpecialtyLinkRow[]>();
  for (const row of res.data ?? []) {
    const id = String((row as { professional_id?: string }).professional_id ?? "");
    const list = linksById.get(id) ?? [];
    list.push(row as SpecialtyLinkRow);
    linksById.set(id, list);
  }
  for (const [id, links] of linksById) out.set(id, specialtiesFromLinks(links));
  return out;
}
