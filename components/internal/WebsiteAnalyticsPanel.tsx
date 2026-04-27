type Props = {
  businessCardVisitsLast7d: number;
};

export function WebsiteAnalyticsPanel({
  businessCardVisitsLast7d,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/25 p-5 shadow-inner shadow-black/20 backdrop-blur-sm">
      <div className="mb-5 border-b border-slate-800/60 pb-4">
        <h2 className="text-sm font-semibold text-slate-100">Website Analytics</h2>
        <p className="text-xs text-slate-500">
          Last 7 days · business card visits tracked from your printed QR campaign.
        </p>
      </div>

      <div className="grid gap-4">
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
      </div>

      <a
        href="https://vercel.com/ros-projects-36c82793/doc-cy/analytics?environment=all"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:text-emerald-200"
      >
        Open Vercel Analytics dashboard
      </a>
    </section>
  );
}

