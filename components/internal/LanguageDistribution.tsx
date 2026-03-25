import { maxCount, type LanguageCount } from "@/lib/founder-metrics";
import { languageThemeForLabel } from "@/lib/cyprus-languages";
import { Languages } from "lucide-react";

type Props = { items: LanguageCount[]; totalDoctorCount: number };

export function LanguageDistribution({ items, totalDoctorCount }: Props) {
  const top = items.slice(0, 8);
  const max = maxCount(top);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/35 p-5 shadow-lg shadow-black/25 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-slate-800/60 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
          <Languages className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Languages</h2>
          <p className="text-xs text-slate-500">
            Times listed · {totalDoctorCount} professional{totalDoctorCount !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>
      {top.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No language data yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {top.map(({ label, count }) => {
            const pct = Math.round((count / max) * 100);
            const share =
              totalDoctorCount > 0
                ? Math.round((count / totalDoctorCount) * 100)
                : 0;
            const barSolid = languageThemeForLabel(label).barClass;
            return (
              <li key={label}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-slate-300">{label}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {count}
                    <span className="text-slate-600"> · {share}% of professionals</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
                  <div
                    className={`h-full rounded-full ${barSolid} shadow-sm transition-all duration-500`}
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
