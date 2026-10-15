/**
 * The Statistics tab's tables show 10 rows at a time (user, 2026-10-15). The rows are
 * already loaded; this only decides which ones show.
 */
export const TABLE_PAGE_SIZE = 10;

export type PagedRows<T> = {
  rows: T[];
  /** 1-based, brought back into range. */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based position of the first and last row shown; 0 and 0 when there are none. */
  from: number;
  to: number;
};

export function paginate<T>(rows: readonly T[], page: number, pageSize: number = TABLE_PAGE_SIZE): PagedRows<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const wanted = Number.isFinite(page) ? Math.floor(page) : 1;
  const current = Math.min(Math.max(wanted, 1), pageCount);
  const start = (current - 1) * pageSize;
  const shown = rows.slice(start, start + pageSize);
  return {
    rows: shown,
    page: current,
    pageCount,
    total,
    from: shown.length > 0 ? start + 1 : 0,
    to: start + shown.length,
  };
}
