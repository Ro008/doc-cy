import { escapeIlikePattern } from "@/lib/finder-results-paging";
import { LISTING_CLINICS_SELECT } from "@/lib/listing-clinic-location";
import { SPECIALTY_FILTER_SELECT, SPECIALTY_LINKS_SELECT } from "@/lib/specialty-catalogue";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

const NO_SPECIALTY_MATCH_ID = "00000000-0000-0000-0000-000000000000";

/**
 * What the finder loads per listing. District, town, address, map link and pin come
 * from its clinics (Point E5), never from copies on `professionals`.
 */
export const FINDER_LISTING_SELECT = `id, slug, name, is_gesy, gender, ${LISTING_CLINICS_SELECT}`;

/** With {@link FINDER_LISTING_SELECT}: the approved specialty labels of each listing. */
export const FINDER_LISTING_SELECT_WITH_SPECIALTIES = `${FINDER_LISTING_SELECT}, ${SPECIALTY_LINKS_SELECT}`;

/**
 * Inner join used only to filter by place: a listing matches a district or town when
 * any of its unarchived clinics is there. A separate alias, so the listing still loads
 * all of its clinics through {@link LISTING_CLINICS_SELECT}.
 */
export const LISTING_LOCATION_FILTER_SELECT =
  "location_filter:professional_clinics!inner(clinics!inner(district, town, is_archived))";

export type FinderListFilters = {
  district: string;
  name: string;
  /** Active catalogue slug (cache keys only); filtering uses `specialtyIds`. */
  specialty: string;
  /**
   * `specialties.id`s the active filter matches (the canonical row plus any
   * legacy-spelling rows). Undefined for no specialty filter; an empty list
   * keeps the filter active and matches nothing.
   */
  specialtyIds?: readonly string[];
  town?: string;
};

/**
 * Adds the inner-join embeds the active filters need (specialty, then place).
 * Without those filters the select clause is unchanged.
 */
export function finderSelectWithListFilters(
  selectClause: string,
  filters: Pick<FinderListFilters, "specialtyIds" | "district" | "town">,
): string {
  let out = selectClause;
  if (filters.specialtyIds) out = `${out}, ${SPECIALTY_FILTER_SELECT}`;
  if (filters.district || filters.town) out = `${out}, ${LISTING_LOCATION_FILTER_SELECT}`;
  return out;
}

/** Finder list source. `professionals` is the unified identity table. */
export type FinderDirectorySource = "directory_manual" | "professionals";

/**
 * Apply district / town / name / specialty filters to a PostgREST query builder.
 * District, town and specialty need {@link finderSelectWithListFilters} in the select.
 */
export function applyFinderListFilters(
  query: any,
  filters: FinderListFilters,
): any {
  let next = query;
  if (filters.district || filters.town) {
    next = next.eq("location_filter.clinics.is_archived", false);
  }
  if (filters.district) {
    next = next.eq("location_filter.clinics.district", filters.district);
  }
  if (filters.town) {
    next = next.eq("location_filter.clinics.town", filters.town);
  }
  if (filters.name) {
    next = next.ilike("name", `%${escapeIlikePattern(filters.name)}%`);
  }
  if (filters.specialtyIds) {
    // No matching catalogue row: keep the filter active with an id nothing has.
    const ids = filters.specialtyIds.length > 0 ? filters.specialtyIds : [NO_SPECIALTY_MATCH_ID];
    next = next.in("specialty_filter.specialty_id", ids);
  }
  return next;
}

/** Exact count for finder list filters. */
export async function countManualDirectoryForFinder(input: {
  supabase: any;
  filters: FinderListFilters;
  source?: FinderDirectorySource;
}): Promise<{ count: number; error: { code?: string; message?: string } | null }> {
  const { supabase, filters, source = "professionals" } = input;
  let q = supabase
    .from(source)
    .select(finderSelectWithListFilters("id", filters), { count: "exact", head: true })
    .eq("is_archived", false);
  if (source === "professionals") {
    q = q.eq("is_registered", false);
  }
  q = applyFinderListFilters(q, filters);
  const { count, error } = await q;
  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

/**
 * Load manual directory rows for finder filters. A listing with a clinic in the
 * filtered district or town is in the result whichever clinic is its primary.
 *
 * Pass `limit` for paged list views (avoids pulling the full GeSY roster into memory).
 */
export async function fetchManualDirectoryForFinder(input: {
  supabase: any;
  selectClause: string;
  filters: FinderListFilters;
  orderByName?: boolean;
  /** Max rows to return (PostgREST range). Omit for unbounded near-me sorts. */
  limit?: number;
  source?: FinderDirectorySource;
}): Promise<{ data: unknown[] | null; error: { code?: string; message?: string } | null }> {
  const { supabase, selectClause, filters, orderByName = false, limit, source = "professionals" } = input;

  const filteredQuery = (): any => {
    let q = supabase
      .from(source)
      .select(finderSelectWithListFilters(selectClause, filters))
      .eq("is_archived", false);
    if (source === "professionals") {
      q = q.eq("is_registered", false);
    }
    q = applyFinderListFilters(q, filters);
    if (orderByName) q = q.order("name", { ascending: true });
    return q;
  };

  const boundedLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : null;

  if (boundedLimit != null) {
    const { data, error } = await filteredQuery().range(0, boundedLimit - 1);
    if (error) return { data: null, error };
    return { data: (data ?? []) as unknown[], error: null };
  }

  return fetchAllSupabaseRows(filteredQuery);
}
