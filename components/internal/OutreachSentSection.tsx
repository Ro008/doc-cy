"use client";

import { useDirectoryNav } from "@/components/internal/DirectoryNavContext";
import type { FounderDashboardQuery, OutreachMonthKey } from "@/lib/founder-dashboard-query";
import { founderDirectoryHref } from "@/lib/founder-dashboard-query";
import { manualDirectoryLandingPath } from "@/lib/manual-directory-landing-path";

export type OutreachSentDashboardRow = {
  id: string;
  name: string;
  slug: string | null;
  bookingCount: number;
  phoneClickCount: number;
  sentAt: string;
};

type Props = {
  query: FounderDashboardQuery;
  fromProductionDatabase: boolean;
  monthLabel: string;
  emailCount: number;
  rows: OutreachSentDashboardRow[];
  tableMissing: boolean;
};

const MONTH_KEYS: { key: OutreachMonthKey; tab: string }[] = [
  { key: "current", tab: "This month" },
  { key: "previous", tab: "Last month" },
];

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

export function OutreachSentSection({
  query,
  fromProductionDatabase,
  monthLabel,
  emailCount,
  rows,
  tableMissing,
}: Props) {
  const { navigate } = useDirectoryNav();

  return (
    <section className="rounded-2xl border border-clinical-500/25 bg-clinical-500/5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 border-b border-clinical-500/20 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-clinical-100">
            Invite emails to unregistered professionals
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-clinical-100/80">
            Tracker of emails we send to professionals listed on the finder who do not have a DocCy
            account yet. Each email shares their patient stats (online booking interest and Show
            phone number taps) so they discover DocCy and sign up.
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-auto sm:max-w-[220px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-clinical-300/80">
            Month
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-clinical-500/30 bg-slate-950/50 p-1">
            {MONTH_KEYS.map(({ key, tab }) => {
              const active = query.outreachMonth === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigate(founderDirectoryHref(query, { outreachMonth: key }))}
                  className={`min-h-[44px] touch-manipulation rounded-md px-2 py-2 text-xs font-medium transition sm:min-h-0 sm:px-2.5 sm:py-1.5 ${
                    active
                      ? "bg-clinical-500/25 text-clinical-100"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 active:bg-slate-800/70"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-medium text-clinical-200/90">
        Showing: <span className="text-clinical-50">{monthLabel}</span>
      </p>

      {fromProductionDatabase ? (
        <p className="mt-2 text-[11px] text-clinical-200/75">
          These counts are from the production database.
        </p>
      ) : (
        <p className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/90">
          This session is connected to the testing database, so these numbers are not production
          sends. For real counts, open this page on mydoccy.com or run the app against production.
        </p>
      )}

      <div className="mt-4 max-w-xs rounded-xl border border-clinical-500/30 bg-slate-950/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-clinical-300/90">
          Emails sent
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{emailCount}</p>
      </div>

      {tableMissing ? (
        <p className="mt-6 text-xs text-slate-400">
          The outreach log table is not on this database yet. Apply the outreach migration, then
          sends will appear here.
        </p>
      ) : rows.length > 0 ? (
        <div className="relative mt-6 -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto overflow-y-visible scroll-smooth overscroll-x-contain px-4 pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:max-w-none sm:px-0">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700/80 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <th className="py-2 pr-3">Professional</th>
                <th className="py-2 pr-3 text-right">Online booking</th>
                <th className="py-2 pr-3 text-right">Show phone</th>
                <th className="py-2 text-right">Sent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = r.slug ? manualDirectoryLandingPath(r.slug) : null;
                return (
                  <tr key={r.id} className="border-b border-slate-800/60 text-slate-200">
                    <td className="max-w-[240px] py-2.5 pr-3 font-medium text-slate-100">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-clinical-200 underline-offset-2 hover:underline"
                        >
                          {r.name}
                        </a>
                      ) : (
                        r.name
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-clinical-200">
                      {r.bookingCount}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">
                      {r.phoneClickCount}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-right text-slate-500">
                      {formatShortDate(r.sentAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 text-xs text-slate-400">
          No outreach emails in {monthLabel} yet.
        </p>
      )}
    </section>
  );
}
