"use client";

import { useDirectoryNav } from "@/components/internal/DirectoryNavContext";

type Props = {
  activeRange: "7d" | "30d" | "90d";
  rangeOptions: {
    key: "7d" | "30d" | "90d";
    label: string;
    href: string;
  }[];
};

export function AnalyticsVisitsRangeTabs({ activeRange, rangeOptions }: Props) {
  const { navigate } = useDirectoryNav();
  return (
    <div className="mt-3 flex w-full rounded-lg border border-slate-700/80 bg-slate-950/50 p-1 sm:inline-flex sm:w-auto">
      {rangeOptions.map((option) => {
        const isActive = option.key === activeRange;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => navigate(option.href)}
            className={`min-h-[40px] flex-1 rounded-md px-2.5 py-2 text-xs font-medium transition sm:min-h-0 sm:flex-none sm:py-1 ${
              isActive
                ? "bg-emerald-500/20 text-emerald-200"
                : "text-slate-400 hover:text-slate-200 active:bg-slate-800/60"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
