import { formatDistanceToNowStrict } from "date-fns";
import type {
  HighInterestSession,
  LocalityCount,
  SectionCount,
} from "@/lib/website-analytics";

type Props = {
  totalVisitsLast7d: number;
  topLocalities: LocalityCount[];
  popularSections: SectionCount[];
  highInterestSessions: HighInterestSession[];
};

export function WebsiteAnalyticsPanel({
  totalVisitsLast7d,
  topLocalities,
  popularSections,
  highInterestSessions,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/25 p-5 shadow-inner shadow-black/20 backdrop-blur-sm">
      <div className="mb-5 border-b border-slate-800/60 pb-4">
        <h2 className="text-sm font-semibold text-slate-100">Website Analytics</h2>
        <p className="text-xs text-slate-500">Accumulated traffic (last 7 days)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Total visits (7d)</p>
          <p className="mt-2 text-3xl font-semibold text-white">{totalVisitsLast7d}</p>
        </div>

        <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Top localities</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-200">
            {topLocalities.length ? (
              topLocalities.map((row) => (
                <li key={row.locality} className="flex items-center justify-between gap-3">
                  <span className="truncate">{row.locality}</span>
                  <span className="text-slate-400">{row.count}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500">No data yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Most popular sections</p>
          <ul className="mt-2 space-y-2 text-sm">
            {popularSections.length ? (
              popularSections.map((row) => (
                <li key={row.section}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-slate-200">{row.section}</span>
                    <span className="text-slate-400">{row.percent}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800">
                    <div
                      className="h-1.5 rounded-full bg-emerald-400/80"
                      style={{ width: `${Math.max(4, row.percent)}%` }}
                    />
                  </div>
                </li>
              ))
            ) : (
              <li className="text-slate-500">No data yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            High-interest sessions
          </p>
          <p className="mt-1 text-xs text-slate-500">Visited 4+ distinct pages</p>
          <ul className="mt-2 space-y-2 text-sm">
            {highInterestSessions.length ? (
              highInterestSessions.map((s) => (
                <li key={s.sessionId} className="rounded-lg border border-slate-800/70 px-3 py-2">
                  <p className="text-slate-200">
                    {s.locality} · {s.pagesVisited} pages ({s.pageViews} views)
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.origin === "ref" && s.refCode ? `ref=${s.refCode} · ` : "direct · "}
                    seen{" "}
                    {formatDistanceToNowStrict(new Date(s.lastSeenAt), { addSuffix: true })}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-slate-500">No high-interest sessions yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

