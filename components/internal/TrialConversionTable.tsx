import { format } from "date-fns";
import {
  computeTrialDaysRemaining,
  getTrialStatus,
  computeTrialEndDate,
} from "@/lib/trial-period";

type TrialRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
};

type Props = {
  doctors: TrialRow[];
};

function statusBadge(daysRemaining: number): { label: string; className: string } {
  const status = getTrialStatus(daysRemaining);
  if (status === "expired") {
    return {
      label: "Expired",
      className: "border border-red-500/40 bg-red-500/15 text-red-200",
    };
  }
  if (status === "expiring_soon") {
    return {
      label: "Expiring Soon",
      className: "border border-orange-500/40 bg-orange-500/15 text-orange-200",
    };
  }
  return {
    label: "Trial Active",
    className: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  };
}

export function TrialConversionTable({ doctors }: Props) {
  const now = new Date();
  const rows = doctors
    .filter((d) => !!d.created_at)
    .map((d) => {
      const trialEnd = computeTrialEndDate(d.created_at as string);
      const daysRemaining = computeTrialDaysRemaining(trialEnd, now);
      return {
        ...d,
        trialEnd,
        daysRemaining,
      };
    })
    .sort((a, b) => a.trialEnd.getTime() - b.trialEnd.getTime());

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/25 p-5 shadow-inner shadow-black/20 backdrop-blur-sm">
      <div className="mb-5 flex items-end justify-between border-b border-slate-800/60 pb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Trial to paid conversions</h2>
          <p className="text-xs text-slate-500">
            Professionals ordered by nearest trial expiration
          </p>
        </div>
        <p className="text-xs text-slate-400">{rows.length} professionals</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Name / Email</th>
              <th className="px-3 py-2 font-medium">Registered</th>
              <th className="px-3 py-2 font-medium">Days left</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const urgent = row.daysRemaining < 3;
              const isExpired = row.daysRemaining <= 0;
              const badge = statusBadge(row.daysRemaining);
              const registeredAt = format(new Date(row.created_at as string), "dd MMM yyyy");

              return (
                <tr
                  key={row.id}
                  className={[
                    "border-t border-slate-800/60",
                    isExpired ? "bg-red-500/10" : urgent ? "bg-orange-500/10" : "",
                  ].join(" ")}
                >
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-100">{row.name}</p>
                    <p className="text-xs text-slate-400">{row.email ?? "No email"}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{registeredAt}</td>
                  <td className="px-3 py-3">
                    <p className={isExpired ? "font-medium text-red-200" : "text-slate-200"}>
                      {isExpired ? `Expired (${Math.abs(row.daysRemaining)}d ago)` : `${row.daysRemaining} days`}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

