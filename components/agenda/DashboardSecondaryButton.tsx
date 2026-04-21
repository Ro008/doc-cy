import * as React from "react";
import { PendingLink } from "@/components/navigation/PendingLink";

export function DashboardSecondaryButton({
  href,
  children,
  "aria-current": ariaCurrent,
}: {
  href: string;
  children: React.ReactNode;
  "aria-current"?: "page" | undefined;
}) {
  return (
    <PendingLink
      href={href}
      aria-current={ariaCurrent}
      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-900/35 px-3 py-1.5 text-sm font-medium text-slate-200 shadow-sm transition hover:border-slate-500/80 hover:bg-slate-800/55 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    >
      {children}
    </PendingLink>
  );
}
