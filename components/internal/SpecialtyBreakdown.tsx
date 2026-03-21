import { maxCount, type SpecialtyCount } from "@/lib/founder-metrics";
import { Stethoscope } from "lucide-react";

const BAR_COLORS = [
  "bg-gradient-to-r from-emerald-500 to-teal-400",
  "bg-gradient-to-r from-sky-500 to-cyan-400",
  "bg-gradient-to-r from-violet-500 to-purple-400",
  "bg-gradient-to-r from-amber-500 to-orange-400",
  "bg-gradient-to-r from-rose-500 to-pink-400",
  "bg-gradient-to-r from-indigo-500 to-blue-400",
];

type Props = { items: SpecialtyCount[] };

export function SpecialtyBreakdown({ items }: Props) {
  const top = items.slice(0, 10);
  const max = maxCount(top);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/35 p-5 shadow-lg shadow-black/25 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-slate-800/60 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <Stethoscope className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Specialty mix</h2>
          <p className="text-xs text-slate-500">Doctors per specialty</p>
        </div>
      </div>
      {top.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No specialty data yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {top.map(({ label, count }, i) => {
            const pct = Math.round((count / max) * 100);
            const barClass = BAR_COLORS[i % BAR_COLORS.length];
            return (
              <li key={label}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-slate-300">{label}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
                  <div
                    className={`h-full rounded-full ${barClass} shadow-sm transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
