type Props = {
  businessCardVisitsCount: number;
  visitsRangeLabel: string;
  activeRange: "7d" | "30d" | "90d";
  rangeOptions: {
    key: "7d" | "30d" | "90d";
    label: string;
    href: string;
  }[];
};

export function WebsiteAnalyticsPanel({
  businessCardVisitsCount,
  visitsRangeLabel,
  activeRange,
  rangeOptions,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/25 p-5 shadow-inner shadow-black/20 backdrop-blur-sm">
      <div className="mb-5 border-b border-slate-800/60 pb-4">
        <h2 className="text-sm font-semibold text-slate-100">Website Analytics</h2>
        <p className="text-xs text-slate-500">
          {visitsRangeLabel} · business card visits tracked from your printed QR campaign.
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-slate-700/80 bg-slate-950/50 p-1">
          {rangeOptions.map((option) => {
            const isActive = option.key === activeRange;
            return (
              <a
                key={option.key}
                href={option.href}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {option.label}
              </a>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400/90">
            Business card (QR scan)
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{businessCardVisitsCount}</p>
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
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="https://vercel.com/ros-projects-36c82793/doc-cy/analytics?environment=all"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:text-emerald-200"
        >
          Open Vercel Analytics dashboard
        </a>
        <a
          href="https://search.google.com/search-console?resource_id=https%3A%2F%2Fmydoccy.com%2F"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:text-emerald-200"
        >
          Open Google Search Console
        </a>
      </div>
    </section>
  );
}

