/**
 * Founder dashboard notice: Postgres page-view / QR campaign tracking was removed
 * to reduce Disk IO on the Free/Nano compute tier.
 */
export function WebsiteAnalyticsPanel() {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/25 p-5 shadow-inner shadow-black/20 backdrop-blur-sm">
      <div className="mb-4 border-b border-slate-800/60 pb-4">
        <h2 className="text-sm font-semibold text-slate-100">Website Analytics</h2>
        <p className="mt-1 text-xs text-slate-500">
          Postgres page-view logging is turned off.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
        <p className="text-sm leading-relaxed text-slate-200">
          We stopped storing DocCy page views and QR campaign hits in Postgres. That
          write-heavy table was a major Disk IO cost on our Free-tier database, and
          the in-app QR counters were no longer useful.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Use Vercel Analytics for overall traffic and Google Search Console for
          search visibility. Printed QR campaigns are not tracked inside DocCy
          anymore.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="https://vercel.com/ros-projects-36c82793/doc-cy/analytics?environment=all"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs font-medium text-clinical-300 transition hover:border-clinical-500/50 hover:text-clinical-200"
        >
          Open Vercel Analytics dashboard
        </a>
        <a
          href="https://search.google.com/search-console?resource_id=https%3A%2F%2Fmydoccy.com%2F"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs font-medium text-clinical-300 transition hover:border-clinical-500/50 hover:text-clinical-200"
        >
          Open Google Search Console
        </a>
      </div>
    </section>
  );
}
