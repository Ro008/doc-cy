import { AnalyticsVisitsRangeTabs } from "@/components/internal/AnalyticsVisitsRangeTabs";

type Props = {
  businessCardVisitsCount: number;
  doctorProfileQrTop: {
    doctorId: string;
    doctorName: string;
    doctorSlug: string;
    scans: number;
  }[];
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
  doctorProfileQrTop,
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
        <div className="mt-3">
          <AnalyticsVisitsRangeTabs activeRange={activeRange} rangeOptions={rangeOptions} />
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-clinical-500/35 bg-clinical-900/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-clinical-400/90">
            Business card (QR scan)
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{businessCardVisitsCount}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Landing hits from your DocCy physical business card campaign, tagged with (
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-300">
              utm_source=offline
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-300">
              utm_medium=business_card
            </code>{" "}
            ) or{" "}
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-300">
              ref=business_card
            </code>
            .
          </p>
        </div>

        <div className="rounded-xl border border-clinical-500/35 bg-ink-900/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-clinical-300/90">
            Doctor profile QR scans
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Top 10 doctors by scans from profile QR tags (
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-300">
              utm_source=doctor_qr
            </code>{" "}
            +{" "}
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-300">
              utm_medium=profile_card
            </code>{" "}
            or{" "}
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-300">
              ref=doctor_profile_qr
            </code>
            ).
          </p>
          <div className="mt-3 space-y-2">
            {doctorProfileQrTop.length === 0 ? (
              <p className="text-xs text-slate-400">
                No doctor profile QR scans recorded for this range yet.
              </p>
            ) : (
              doctorProfileQrTop.map((row, idx) => (
                <div
                  key={row.doctorId}
                  className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {idx + 1}. {row.doctorName}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">/{row.doctorSlug}</p>
                  </div>
                  <p className="ml-3 text-sm font-semibold text-clinical-200">{row.scans}</p>
                </div>
              ))
            )}
          </div>
        </div>
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

