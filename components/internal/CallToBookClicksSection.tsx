"use client";

import { useDirectoryNav } from "@/components/internal/DirectoryNavContext";
import type { CallToBookRangeKey, FounderDashboardQuery } from "@/lib/founder-dashboard-query";
import {
  founderDirectoryHref,
  getCallToBookRangeLabel,
} from "@/lib/founder-dashboard-query";

export type CallToBookDashboardRow = {
  manualId: string;
  name: string;
  district: string | null;
  specialty: string | null;
  count: number;
  finderCount: number;
  professionalProfileCount: number;
  lastAt: string;
};

type Props = {
  query: FounderDashboardQuery;
  total: number;
  finderCount: number;
  professionalProfileCount: number;
  rows: CallToBookDashboardRow[];
};

const RANGE_KEYS: CallToBookRangeKey[] = ["7d", "30d", "90d"];

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function CallToBookClicksSection({
  query,
  total,
  finderCount,
  professionalProfileCount,
  rows,
}: Props) {
  const { navigate } = useDirectoryNav();
  const rangeLabel = getCallToBookRangeLabel(query.callToBookRange);

  return (
    <section className="rounded-2xl border border-clinical-500/25 bg-clinical-500/5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 border-b border-clinical-500/20 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-clinical-100">Show phone number clicks</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-clinical-100/80">
            Each row in{" "}
            <code className="rounded bg-black/30 px-1">professional_call_to_book_clicks</code> is
            a patient tap on Show phone number (phone revealed for that location). Finder cards and
            professional profile pages are counted separately.
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-auto sm:max-w-[220px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-clinical-300/80">
            Date range
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-clinical-500/30 bg-slate-950/50 p-1 sm:flex sm:gap-0">
            {RANGE_KEYS.map((key) => {
              const active = query.callToBookRange === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigate(founderDirectoryHref(query, { callToBookRange: key }))}
                  className={`min-h-[44px] touch-manipulation rounded-md px-2 py-2 text-xs font-medium transition sm:min-h-0 sm:px-2.5 sm:py-1.5 ${
                    active
                      ? "bg-clinical-500/25 text-clinical-100"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 active:bg-slate-800/70"
                  }`}
                >
                  {key === "7d" ? "Week" : key === "30d" ? "Month" : "Quarter"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-medium text-clinical-200/90">
        Showing: <span className="text-clinical-50">{rangeLabel}</span>
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-clinical-500/30 bg-slate-950/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-clinical-300/90">
            Total clicks
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Finder cards
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">{finderCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Professional profile page
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">{professionalProfileCount}</p>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="relative mt-6 -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto overflow-y-visible scroll-smooth overscroll-x-contain px-4 pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:max-w-none sm:px-0">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700/80 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <th className="py-2 pr-3">Professional</th>
                <th className="py-2 pr-3">Specialty</th>
                <th className="py-2 pr-3">District</th>
                <th className="py-2 pr-3 text-right">Clicks</th>
                <th className="py-2 pr-3 text-right">Finder</th>
                <th className="py-2 pr-3 text-right">Prof. profile</th>
                <th className="py-2 text-right">Last click</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.manualId} className="border-b border-slate-800/60 text-slate-200">
                  <td className="max-w-[180px] truncate py-2.5 pr-3 font-medium text-slate-100">
                    {r.name}
                  </td>
                  <td className="max-w-[160px] truncate py-2.5 pr-3 text-slate-300" title={r.specialty ?? ""}>
                    {r.specialty ?? "—"}
                  </td>
                  <td className="max-w-[100px] truncate py-2.5 pr-3 text-slate-400">
                    {r.district ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-clinical-200">{r.count}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">{r.finderCount}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">{r.professionalProfileCount}</td>
                  <td className="whitespace-nowrap py-2.5 text-right text-slate-500">
                    {formatShortDate(r.lastAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 text-xs text-slate-400">
          No Show phone number clicks in {rangeLabel.toLowerCase()} yet. They appear here after
          patients tap the button on finder cards or professional profile pages.
        </p>
      )}
    </section>
  );
}
