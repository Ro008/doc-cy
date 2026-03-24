import * as React from "react";

export function DashboardUtilityRow({
  left,
  right,
  className = "",
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-3 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${className}`}
    >
      <div className="min-w-0">{left}</div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
        {right}
      </div>
    </div>
  );
}
