import { formatDistanceToNowStrict } from "date-fns";
import type {
  HighInterestSession,
  LocalityCount,
  SectionCount,
} from "@/lib/website-analytics";

type Props = {
  businessCardVisitsLast7d: number;
  websiteAndLinkVisitsLast7d: number;
  topLocalities: LocalityCount[];
  popularSections: SectionCount[];
  highInterestSessions: HighInterestSession[];
};

export function WebsiteAnalyticsPanel({
  businessCardVisitsLast7d,
  websiteAndLinkVisitsLast7d,
  topLocalities,
  popularSections,
  highInterestSessions,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/25 p-5 shadow-inner shadow-black/20 backdrop-blur-sm">
      <div className="mb-5 border-b border-slate-800/60 pb-4">
        <h2 className="text-sm font-semibold text-slate-100">Website Analytics</h2>
        <p className="text-xs text-slate-500">
          Last 7 days · headline counts are exact (not limited to 1,000 rows).           Excludes likely bots (User-Agent heuristic). Playwright test hits omitted when suppress
          secret is configured.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400/90">
            Business card (QR scan)
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{businessCardVisitsLast7d}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Landing hits that include{" "}
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-300">
              utm_source=offline
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-300">
              utm_medium=business_card
            </code>{" "}
            (your printed QR).
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Website & links</p>
          <p className="mt-2 text-3xl font-semibold text-white">{websiteAndLinkVisitsLast7d}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            All other logged visits: typing{" "}
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-300">
              mydoccy.com
            </code>
            , search, bookmarks, shared links, other campaigns — not the business-card UTM pair above.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Top localities</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
            Approximate IP geo (Vercel). This list is non-bot only; some automated traffic may still
            look like a normal browser.
          </p>
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

      <p className="mt-4 text-xs leading-relaxed text-slate-600">
        E2E tests do not add rows when the deployment sets{" "}
        <code className="rounded bg-slate-950/60 px-1 py-0.5 font-mono text-[11px] text-slate-400">
          DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET
        </code>{" "}
        and Playwright uses the same value (e.g. Vercel env + GitHub Actions secret). Older rows from
        before that setup may still include test noise.
      </p>
    </section>
  );
}

