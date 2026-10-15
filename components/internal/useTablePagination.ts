"use client";

import { useState } from "react";

import { paginate, TABLE_PAGE_SIZE, type PagedRows } from "@/lib/table-pagination";

/**
 * Which page of a table is showing. A new `resetKey` (a new sort, range or filter) goes
 * back to the first page, so a founder never lands on page 3 of a different list.
 */
export function useTablePagination<T>(
  rows: readonly T[],
  options: { resetKey?: string; pageSize?: number } = {},
): PagedRows<T> & { setPage: (page: number) => void } {
  const resetKey = options.resetKey ?? "";
  const [state, setState] = useState({ page: 1, key: resetKey });
  const requested = state.key === resetKey ? state.page : 1;
  const paged = paginate(rows, requested, options.pageSize ?? TABLE_PAGE_SIZE);
  return { ...paged, setPage: (page: number) => setState({ page, key: resetKey }) };
}
