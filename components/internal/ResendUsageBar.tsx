const RESEND_FREE_CAP = 3000;

type Props = {
  /** Each booking sends ~2 notification emails (doctor + patient). */
  totalAppointments: number;
};

export function ResendUsageBar({ totalAppointments }: Props) {
  const estimatedEmails = totalAppointments * 2;
  const pct = Math.min(100, (estimatedEmails / RESEND_FREE_CAP) * 100);
  const over = estimatedEmails > RESEND_FREE_CAP;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-medium text-slate-300">
          Resend usage <span className="text-slate-500">(est.)</span>
        </p>
        <p className="tabular-nums text-slate-400">
          <span className={over ? "text-amber-400" : "text-slate-200"}>
            {estimatedEmails.toLocaleString()}
          </span>
          <span className="text-slate-600"> / </span>
          {RESEND_FREE_CAP.toLocaleString()}
          <span className="text-slate-500"> emails · free tier</span>
        </p>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Model: appointments × 2 (patient + doctor notification per booking).
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={Math.min(estimatedEmails, RESEND_FREE_CAP)}
        aria-valuemin={0}
        aria-valuemax={RESEND_FREE_CAP}
        aria-label="Estimated Resend emails used this billing period"
      >
        <div
          className={`h-full rounded-full transition-all ${
            over
              ? "bg-gradient-to-r from-amber-500 to-red-500"
              : "bg-gradient-to-r from-emerald-500 to-cyan-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over ? (
        <p className="mt-2 text-[11px] text-amber-400/90">
          Estimate exceeds free tier — upgrade Resend or reduce sends.
        </p>
      ) : null}
    </div>
  );
}
