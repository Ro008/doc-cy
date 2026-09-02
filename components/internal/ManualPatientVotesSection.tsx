"use client";

import { useDirectoryNav } from "@/components/internal/DirectoryNavContext";
import type {
  FounderDashboardQuery,
  ManualVotesRangeKey,
  ManualVotesSortCol,
} from "@/lib/founder-dashboard-query";
import {
  founderDirectoryHref,
  getManualVotesRangeLabel,
  nextManualVotesSort,
} from "@/lib/founder-dashboard-query";

export type ManualPatientVoteRow = {
  manualId: string;
  name: string;
  district: string | null;
  specialty: string | null;
  count: number;
  lastAt: string;
};

type PodiumEntry = {
  rank: 1 | 2 | 3;
  name: string;
  specialty: string | null;
  count: number;
};

type Props = {
  query: FounderDashboardQuery;
  rows: ManualPatientVoteRow[];
  podium: PodiumEntry[];
  maxVotes: number;
};

const RANGE_KEYS: ManualVotesRangeKey[] = ["7d", "30d", "90d"];

function sortGlyph(activeCol: ManualVotesSortCol, activeDir: "asc" | "desc", col: ManualVotesSortCol) {
  if (activeCol !== col) return "";
  return activeDir === "desc" ? " ↓" : " ↑";
}

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

const headerBtn =
  "touch-manipulation text-left text-slate-400 transition hover:text-clinical-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-500/60";

export function ManualPatientVotesSection({ query, rows, podium, maxVotes }: Props) {
  const { navigate } = useDirectoryNav();
  const rangeLabel = getManualVotesRangeLabel(query.manualVotesRange);
  const medal = (r: 1 | 2 | 3) => (r === 1 ? "🥇" : r === 2 ? "🥈" : "🥉");
  const tierClass = (r: 1 | 2 | 3) =>
    r === 1
      ? "border-amber-400/50 bg-gradient-to-b from-amber-500/25 to-amber-950/30 shadow-[0_0_28px_-8px_rgba(251,191,36,0.45)]"
      : r === 2
        ? "border-slate-400/40 bg-gradient-to-b from-slate-400/20 to-slate-950/40"
        : "border-orange-700/45 bg-gradient-to-b from-orange-700/20 to-slate-950/40";

  const podiumSorted = [...podium].sort((a, b) => a.rank - b.rank);

  return (
    <section className="rounded-2xl border border-clinical-500/25 bg-clinical-500/5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 border-b border-clinical-500/20 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-clinical-100">
            Manual directory: patient votes for online booking
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-clinical-100/80">
            Every Request online booking tap is stored as a new row in Supabase table{" "}
            <code className="rounded bg-black/30 px-1">public.professional_patient_booking_requests</code>{" "}
            (<code className="rounded bg-black/30 px-1">professional_id</code>,{" "}
            <code className="rounded bg-black/30 px-1">created_at</code>,{" "}
            <code className="rounded bg-black/30 px-1">source</code>,{" "}
            <code className="rounded bg-black/30 px-1">clinic_id</code>,{" "}
            <code className="rounded bg-black/30 px-1">voter_key</code>). Numbers below are those
            rows in the selected window. The public finder badge still shows unique patients (via{" "}
            <code className="rounded bg-black/30 px-1">voter_key</code>), not tap count.
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-auto sm:max-w-[220px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-clinical-300/80">
            Date range
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-clinical-500/30 bg-slate-950/50 p-1 sm:flex sm:gap-0">
            {RANGE_KEYS.map((key) => {
              const active = query.manualVotesRange === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigate(founderDirectoryHref(query, { manualVotesRange: key }))}
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

      {podium.length > 0 ? (
        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/95">
            Top 3 this period
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:items-end">
            {podiumSorted.map((row) => {
              const pct = maxVotes > 0 ? Math.max(8, Math.round((row.count / maxVotes) * 100)) : 8;
              const orderMobile =
                row.rank === 1 ? "order-1" : row.rank === 2 ? "order-2" : "order-3";
              const orderDesktop =
                row.rank === 1
                  ? "sm:order-2 sm:-translate-y-1"
                  : row.rank === 2
                    ? "sm:order-1"
                    : "sm:order-3";
              return (
                <div
                  key={row.rank}
                  className={`relative flex flex-col rounded-2xl border px-3 pb-3 pt-3 ${tierClass(row.rank)} ${orderMobile} ${orderDesktop} ${
                    row.rank === 1 ? "min-h-[180px] sm:min-h-[212px]" : "min-h-[160px] sm:min-h-[168px]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl" aria-hidden>
                      {medal(row.rank)}
                    </span>
                    <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white">
                      +{row.count} XP
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-white" title={row.name}>
                    {row.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400" title={row.specialty ?? ""}>
                    {row.specialty ?? "—"}
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/40">
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.rank === 1
                          ? "bg-gradient-to-r from-amber-300 to-amber-500"
                          : row.rank === 2
                            ? "bg-gradient-to-r from-slate-300 to-slate-500"
                            : "bg-gradient-to-r from-orange-400 to-orange-600"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {row.rank === 1 ? "Champion" : row.rank === 2 ? "Runner-up" : "On the podium"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="relative mt-6 -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto overflow-y-visible scroll-smooth overscroll-x-contain px-4 pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:max-w-none sm:px-0">
          <table className="w-full min-w-[520px] text-left text-xs sm:min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-700/80 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <th className="py-2 pr-2 sm:pr-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(founderDirectoryHref(query, nextManualVotesSort(query, "name")))
                    }
                    className={`${headerBtn} inline-flex w-full items-center gap-0.5`}
                  >
                    Professional
                    {sortGlyph(query.manualVotesCol, query.manualVotesDir, "name")}
                  </button>
                </th>
                <th className="py-2 pr-2 sm:pr-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        founderDirectoryHref(query, nextManualVotesSort(query, "specialty")),
                      )
                    }
                    className={`${headerBtn} inline-flex w-full items-center gap-0.5`}
                  >
                    Specialty
                    {sortGlyph(query.manualVotesCol, query.manualVotesDir, "specialty")}
                  </button>
                </th>
                <th className="py-2 pr-2 sm:pr-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        founderDirectoryHref(query, nextManualVotesSort(query, "district")),
                      )
                    }
                    className={`${headerBtn} inline-flex w-full items-center gap-0.5`}
                  >
                    District
                    {sortGlyph(query.manualVotesCol, query.manualVotesDir, "district")}
                  </button>
                </th>
                <th className="py-2 pr-2 text-right sm:pr-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(founderDirectoryHref(query, nextManualVotesSort(query, "votes")))
                    }
                    className={`${headerBtn} inline-flex w-full items-center justify-end gap-0.5`}
                  >
                    <span className="hidden min-[380px]:inline">Unique votes (approx.)</span>
                    <span className="min-[380px]:hidden">Votes</span>
                    {sortGlyph(query.manualVotesCol, query.manualVotesDir, "votes")}
                  </button>
                </th>
                <th className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(founderDirectoryHref(query, nextManualVotesSort(query, "last")))
                    }
                    className={`${headerBtn} inline-flex w-full items-center justify-end gap-0.5`}
                  >
                    Last vote
                    {sortGlyph(query.manualVotesCol, query.manualVotesDir, "last")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.manualId} className="border-b border-slate-800/60 text-slate-200">
                  <td className="max-w-[140px] truncate py-2.5 pr-2 font-medium text-slate-100 sm:max-w-[200px] sm:py-2 sm:pr-3">
                    {r.name}
                  </td>
                  <td
                    className="max-w-[120px] truncate py-2.5 pr-2 text-slate-300 sm:max-w-[160px] sm:py-2 sm:pr-3"
                    title={r.specialty ?? ""}
                  >
                    {r.specialty ?? "—"}
                  </td>
                  <td className="max-w-[100px] truncate py-2.5 pr-2 text-slate-400 sm:py-2 sm:pr-3">
                    {r.district ?? "—"}
                  </td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-clinical-200 sm:py-2 sm:pr-3">
                    {r.count}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right text-slate-500 sm:py-2">
                    {formatShortDate(r.lastAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 text-xs text-slate-400">
          No votes in {rangeLabel.toLowerCase()} yet. When the finder gets traffic, rows appear here.
        </p>
      )}
    </section>
  );
}
