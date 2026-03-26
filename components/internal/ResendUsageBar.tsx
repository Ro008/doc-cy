import type {
  ResendAccountQuota,
  ResendQuotaFailureReason,
} from "@/lib/resend-quota";

const RESEND_FREE_MONTHLY_CAP = 3000;
const RESEND_FREE_DAILY_CAP = 100;

type Props = {
  totalAppointments: number;
  /** When present, numbers match Resend dashboard (Usage). */
  liveQuota: ResendAccountQuota | null;
  /** Set when live quota could not be loaded (for clearer copy). */
  quotaFailureReason?: ResendQuotaFailureReason | null;
};

function fallbackExplanation(reason: ResendQuotaFailureReason | null | undefined) {
  if (reason === "missing_api_key") {
    return (
      <>
        Add <code className="rounded bg-slate-800/80 px-1">RESEND_API_KEY</code>{" "}
        to your environment (same key as transactional email). Restart the dev
        server after changing{" "}
        <code className="rounded bg-slate-800/80 px-1">.env.local</code>.
      </>
    );
  }
  if (reason === "http_error") {
    return (
      <>
        Resend API rejected the request (invalid key, revoked key, or network
        issue). Check the key in{" "}
        <span className="text-slate-400">resend.com → API Keys</span>.
      </>
    );
  }
  if (reason === "no_quota_headers") {
    return (
      <>
        Resend responded but did not include quota headers (API or plan may have
        changed). Compare with{" "}
        <span className="text-slate-400">resend.com → Usage</span>. Below is a
        DocCy-only estimate.
      </>
    );
  }
  return (
    <>
      Could not read Resend quotas. Check{" "}
      <code className="rounded bg-slate-800/80 px-1">RESEND_API_KEY</code> and
      restart the server.
    </>
  );
}

export function ResendUsageBar({
  totalAppointments,
  liveQuota,
  quotaFailureReason,
}: Props) {
  const estimatedFromBookings = totalAppointments * 2;
  const useLive = liveQuota != null;

  const monthlyUsed = useLive ? liveQuota.monthlyUsed : estimatedFromBookings;
  const monthlyCap = RESEND_FREE_MONTHLY_CAP;
  const monthlyPct = Math.min(100, (monthlyUsed / monthlyCap) * 100);
  const monthlyOver = monthlyUsed > monthlyCap;

  const dailyUsed = useLive ? liveQuota.dailyUsed : null;
  const dailyCap = RESEND_FREE_DAILY_CAP;
  const dailyPct =
    dailyUsed != null ? Math.min(100, (dailyUsed / dailyCap) * 100) : 0;
  const dailyOver = dailyUsed != null && dailyUsed > dailyCap;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-medium text-slate-300">
          Resend usage
          {useLive ? (
            <span className="text-slate-500"> · live</span>
          ) : (
            <span className="text-slate-500"> · est.</span>
          )}
        </p>
        <p className="tabular-nums text-slate-400">
          <span className={monthlyOver ? "text-amber-400" : "text-slate-200"}>
            {monthlyUsed.toLocaleString()}
          </span>
          <span className="text-slate-600"> / </span>
          {monthlyCap.toLocaleString()}
          <span className="text-slate-500"> · monthly (free tier)</span>
        </p>
      </div>

      {dailyUsed != null ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-2 text-[11px]">
          <p className="font-medium text-slate-400">Today</p>
          <p className="tabular-nums text-slate-500">
            <span className={dailyOver ? "text-amber-400" : "text-slate-300"}>
              {dailyUsed.toLocaleString()}
            </span>
            <span className="text-slate-600"> / </span>
            {dailyCap.toLocaleString()}
            <span className="text-slate-600"> · daily cap</span>
          </p>
        </div>
      ) : null}

      <p className="mt-1 text-[11px] text-slate-500">
        {useLive ? (
          <>
            Pulled from your Resend account (same period as{" "}
            <span className="text-slate-400">resend.com → Usage</span>). Includes
            all sends on this API key, not only booking notifications.
          </>
        ) : (
          <>
            {fallbackExplanation(quotaFailureReason)}{" "}
            <span className="text-slate-600">
              Model: appointments × 2 (patient + doctor per booking).
            </span>
          </>
        )}
      </p>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={Math.min(monthlyUsed, monthlyCap)}
        aria-valuemin={0}
        aria-valuemax={monthlyCap}
        aria-label={
          useLive
            ? "Resend monthly email quota used"
            : "Estimated Resend emails from DocCy bookings"
        }
      >
        <div
          className={`h-full rounded-full transition-all ${
            monthlyOver
              ? "bg-gradient-to-r from-amber-500 to-red-500"
              : "bg-gradient-to-r from-emerald-500 to-cyan-400"
          }`}
          style={{ width: `${monthlyPct}%` }}
        />
      </div>

      {dailyUsed != null ? (
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800/90"
          role="progressbar"
          aria-valuenow={Math.min(dailyUsed, dailyCap)}
          aria-valuemin={0}
          aria-valuemax={dailyCap}
          aria-label="Resend daily email quota used"
        >
          <div
            className={`h-full rounded-full transition-all ${
              dailyOver
                ? "bg-gradient-to-r from-amber-500 to-orange-500"
                : "bg-sky-500/80"
            }`}
            style={{ width: `${dailyPct}%` }}
          />
        </div>
      ) : null}

      {monthlyOver ? (
        <p className="mt-2 text-[11px] text-amber-400/90">
          Above free monthly cap — upgrade Resend or wait for the next billing
          period.
        </p>
      ) : null}

      {useLive && estimatedFromBookings > 0 ? (
        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
          DocCy booking-notification estimate (all-time):{" "}
          {estimatedFromBookings.toLocaleString()} emails (~{totalAppointments}{" "}
          appointments × 2).
        </p>
      ) : null}
    </div>
  );
}
