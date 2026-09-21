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

import { getCachedDirectoryPayload } from "@/lib/finder-directory-cache";
import { slugToSpecialty, specialtyToSlug } from "@/lib/finder-seo";
import {
  harmonizeFinderSpecialtyLabel,
  harmonizeFinderSpecialtyList,
} from "@/lib/finder-specialty-harmonize";
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

/**
 * Display names for a `professionals` row selected with `SPECIALTY_LINKS_SELECT`.
 * The denormalized `specialties` / `specialty` columns are only a fallback for a
 * listing written before its join rows existed (they go away in Point C3).
 */
export function specialtyNamesForRow(row: {
  specialty_links?: unknown;
  specialty?: string | null;
  specialties?: readonly string[] | null;
}): string[] {
  const linked = specialtiesFromLinks(row.specialty_links).map((label) => label.name);
  if (linked.length > 0) return linked;
  const legacy = Array.isArray(row.specialties)
    ? row.specialties.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];
  return harmonizeFinderSpecialtyList(
    legacy.length > 0 ? legacy : [String(row.specialty ?? "").trim()].filter(Boolean),
  );
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
 * Specialty ids with at least one professional the finder shows in `district`
 * (all districts when empty): active scraped listings with `finder_visible`, and
 * verified registered professionals. District is the professional's own district,
 * as the finder's database filter uses.
 */
export async function loadFinderAvailableSpecialtyIds(
  supabase: SupabaseClient,
  district: string,
): Promise<Set<string>> {
  const ids = await getCachedDirectoryPayload(
    ["specialty-available", district || "all"],
    async () => {
      // One row per specialty that has at least one matching professional (the
      // nested !inner filters), capped at one child: ~60 rows instead of paging
      // through every join row (~7k, several seconds uncached).
      const load = (registered: boolean) => {
        const pro = "professional_specialties.professionals";
        let q = supabase
          .from("specialties")
          .select("id, professional_specialties!inner(id, professionals!inner(id))")
          .eq("professional_specialties.is_approved", true)
          .eq(`${pro}.is_archived`, false)
          .eq(`${pro}.is_registered`, registered);
        q = registered
          ? q.eq(`${pro}.status`, "verified").not(`${pro}.slug`, "is", null)
          : q.eq(`${pro}.finder_visible`, true);
        if (district) q = q.eq(`${pro}.district`, district);
        return q.limit(1, { referencedTable: "professional_specialties" });
      };
      const [scraped, registered] = await Promise.all([load(false), load(true)]);
      const error = scraped.error ?? registered.error;
      if (error) throw new Error(`specialty availability: ${error.message}`);
      const out = new Set<string>();
      for (const row of [...(scraped.data ?? []), ...(registered.data ?? [])]) {
        const id = String((row as { id?: string }).id ?? "").trim();
        if (id) out.add(id);
      }
      return [...out];
    },
  );
  return new Set(ids);
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
