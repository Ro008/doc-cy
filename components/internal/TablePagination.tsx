"use client";

type Props = {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
};

const buttonClass =
  "rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-500/60";

/** Under a Statistics table: which rows show, and Previous / Next. Nothing for a single page. */
export function TablePagination({ page, pageCount, total, from, to, onPageChange }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Pages"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/60 pt-3 text-xs text-slate-400"
    >
      <p>
        Showing {from}–{to} of {total}
        <span className="ml-3 text-slate-500">
          Page {page} of {pageCount}
        </span>
      </p>
      <div className="flex gap-2">
        <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
