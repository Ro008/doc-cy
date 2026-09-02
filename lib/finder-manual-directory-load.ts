import { escapeIlikePattern, finderSpecialtyDbMatchValues } from "@/lib/finder-results-paging";
import {
  SUPABASE_IN_FILTER_CHUNK,
  fetchAllSupabaseRows,
  fetchAllSupabaseRowsForIdChunks,
} from "@/lib/supabase-fetch-all";

export type FinderListFilters = {
  district: string;
  name: string;
  specialty: string;
  town?: string;
};

/** Finder list source. `professionals` is the unified identity table. */
export type FinderDirectorySource = "directory_manual" | "professionals";

/**
 * Apply district / name / specialty filters to a PostgREST query builder.
 *
 * IMPORTANT: never fold large `extraDistrictManualIds` into a single
 * `.or(...,id.in.(uuid,uuid,...))` — PostgREST rejects ~1–2k UUIDs (Limassol).
 * Merge clinic-linked extras via {@link fetchManualDirectoryForFinder} instead.
 */
export function applyFinderListFilters(
  query: any,
  filters: FinderListFilters,
  options?: {
    specialtyColumn?: "specialty" | "specialties";
  },
): any {
  let next = query;
  if (filters.district) {
    next = next.eq("district", filters.district);
  }
  if (filters.town) {
    next = next.eq("town", filters.town);
  }
  if (filters.name) {
    next = next.ilike("name", `%${escapeIlikePattern(filters.name)}%`);
  }
  if (filters.specialty) {
    const values = finderSpecialtyDbMatchValues(filters.specialty);
    if (values.length > 0) {
      if (options?.specialtyColumn === "specialties") {
        next = next.overlaps("specialties", values);
      } else if (values.length === 1) {
        next = next.eq("specialty", values[0]!);
      } else {
        next = next.in("specialty", values);
      }
    }
  }
  return next;
}

/** Extra clinic-linked IDs that are not already in the primary district result set. */
export function extrasNotInPrimary(
  primaryIds: readonly string[],
  extraDistrictManualIds: readonly string[],
): string[] {
  const seen = new Set(
    primaryIds.map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  return extraDistrictManualIds
    .map((id) => String(id ?? "").trim())
    .filter((id) => id && !seen.has(id));
}

/**
 * True when extras must be fetched in chunks (never one giant `id.in`).
 * Exposed for tests / docs — production always uses {@link fetchAllSupabaseRowsForIdChunks}.
 */
export function mustChunkExtraManualIds(extraCount: number): boolean {
  return extraCount > SUPABASE_IN_FILTER_CHUNK;
}

/**
 * Exact count for finder list filters (primary district only — clinic-linked
 * extras are omitted when {@link fetchManualDirectoryForFinder} uses `limit`).
 */
export async function countManualDirectoryForFinder(input: {
  supabase: any;
  filters: FinderListFilters;
  specialtyColumn?: "specialty" | "specialties";
  requireFinderVisible?: boolean;
  source?: FinderDirectorySource;
}): Promise<{ count: number; error: { code?: string; message?: string } | null }> {
  const {
    supabase,
    filters,
    specialtyColumn,
    requireFinderVisible = false,
    source = "professionals",
  } = input;
  let q = supabase
    .from(source)
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false);
  if (source === "professionals") {
    q = q.eq("is_registered", false);
  }
  if (requireFinderVisible) {
    q = q.eq("finder_visible", true);
  }
  q = applyFinderListFilters(q, filters, { specialtyColumn });
  const { count, error } = await q;
  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

/**
 * Load manual directory rows for finder filters.
 *
 * Pros linked to a clinic in the active district (but with another primary district)
 * are merged via chunked `id.in` — never a single huge PostgREST `or`/`in` URL.
 *
 * Pass `limit` for paged list views (avoids pulling the full GeSY roster into memory).
 * When `limit` is set, clinic-linked extras are skipped so the page stays bounded.
 */
export async function fetchManualDirectoryForFinder(input: {
  supabase: any;
  selectClause: string;
  filters: FinderListFilters;
  specialtyColumn?: "specialty" | "specialties";
  extraDistrictManualIds?: readonly string[];
  requireFinderVisible?: boolean;
  orderByName?: boolean;
  /** Max rows to return (PostgREST range). Omit for unbounded near-me sorts. */
  limit?: number;
  source?: FinderDirectorySource;
}): Promise<{ data: unknown[] | null; error: { code?: string; message?: string } | null }> {
  const {
    supabase,
    selectClause,
    filters,
    specialtyColumn,
    extraDistrictManualIds = [],
    requireFinderVisible = false,
    orderByName = false,
    limit,
    source = "professionals",
  } = input;

  const baseQuery = (): any => {
    let q = supabase.from(source).select(selectClause).eq("is_archived", false);
    if (source === "professionals") {
      q = q.eq("is_registered", false);
    }
    if (requireFinderVisible && selectClause.includes("finder_visible")) {
      q = q.eq("finder_visible", true);
    }
    return q;
  };

  const boundedLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : null;

  if (boundedLimit != null) {
    let q = applyFinderListFilters(baseQuery(), filters, { specialtyColumn });
    if (orderByName) q = q.order("name", { ascending: true });
    q = q.range(0, boundedLimit - 1);
    const { data, error } = await q;
    if (error) return { data: null, error };
    return { data: (data ?? []) as unknown[], error: null };
  }

  const primaryRes = await fetchAllSupabaseRows(() => {
    let q = applyFinderListFilters(baseQuery(), filters, { specialtyColumn });
    if (orderByName) q = q.order("name", { ascending: true });
    return q;
  });
  if (primaryRes.error) return primaryRes;

  const primaryRows = (primaryRes.data ?? []) as Array<{ id?: string; name?: string | null }>;
  const extrasOnly = extrasNotInPrimary(
    primaryRows.map((row) => String(row.id ?? "")),
    extraDistrictManualIds,
  );

  if (extrasOnly.length === 0) {
    return { data: primaryRows, error: null };
  }

  // Extras already matched via clinic district/town — do not re-filter by primary location.
  const extraFilters = { ...filters, district: "", town: "" };
  const extraRes = await fetchAllSupabaseRowsForIdChunks(extrasOnly, (idChunk) =>
    applyFinderListFilters(baseQuery().in("id", idChunk), extraFilters, { specialtyColumn }),
  );

  // Prefer primary district hits over failing the whole page if extras blow up.
  if (extraRes.error) {
    return { data: primaryRows, error: null };
  }

  const merged = [
    ...primaryRows,
    ...((extraRes.data ?? []) as Array<{ id?: string; name?: string | null }>),
  ];
  if (orderByName) {
    merged.sort((a, b) => {
      const an = String(a.name ?? "");
      const bn = String(b.name ?? "");
      return an.localeCompare(bn, undefined, { sensitivity: "base" });
    });
  }
  return { data: merged, error: null };
}
