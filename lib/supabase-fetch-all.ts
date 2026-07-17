/**
 * Paginate Supabase/PostgREST selects past the default ~1000-row cap.
 * Callers pass a query that already has filters/order; we only apply `.range()`.
 */
export const SUPABASE_PAGE_SIZE = 1000;

type RangeResult<T> = {
  data: T[] | null;
  error: { code?: string; message?: string } | null;
};

type RangeQuery<T> = {
  range: (from: number, to: number) => PromiseLike<RangeResult<T>> | RangeResult<T>;
};

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
