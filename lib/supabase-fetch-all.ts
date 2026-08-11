/**
 * Paginate Supabase/PostgREST selects past the default ~1000-row cap.
 * Callers pass a query that already has filters/order; we only apply `.range()`.
 *
 * Note: `.limit(5000)` does NOT bypass the server max-rows (~1000). Always page
 * with this helper (or SQL aggregates) when a result set can exceed that cap.
 */
export const SUPABASE_PAGE_SIZE = 1000;

/** Keep `.in(...)` URL/body size safe for PostgREST. */
export const SUPABASE_IN_FILTER_CHUNK = 200;

type RangeResult<T> = {
  data: T[] | null;
  error: { code?: string; message?: string } | null;
};

type RangeQuery<T> = {
  range: (from: number, to: number) => PromiseLike<RangeResult<T>> | RangeResult<T>;
};

export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [Array.from(items)];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function fetchAllSupabaseRows<T>(
  buildQuery: () => RangeQuery<T>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<RangeResult<T>> {
  const all: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) {
      return { data: all.length > 0 ? all : null, error };
    }
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) {
      return { data: all, error: null };
    }
    from += pageSize;
  }
}

/** Page through results for each id chunk of a large `.in(...)` filter. */
export async function fetchAllSupabaseRowsForIdChunks<T>(
  ids: readonly string[],
  buildQuery: (idChunk: string[]) => RangeQuery<T>,
  options?: { idChunkSize?: number; pageSize?: number },
): Promise<RangeResult<T>> {
  const all: T[] = [];
  const idChunkSize = options?.idChunkSize ?? SUPABASE_IN_FILTER_CHUNK;
  for (const idChunk of chunkArray(ids, idChunkSize)) {
    if (idChunk.length === 0) continue;
    const res = await fetchAllSupabaseRows(() => buildQuery(idChunk), options?.pageSize);
    if (res.error) {
      return { data: all.length > 0 ? all : null, error: res.error };
    }
    all.push(...(res.data ?? []));
  }
  return { data: all, error: null };
}
