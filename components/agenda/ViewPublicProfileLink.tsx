import Link from "next/link";
import { ExternalLink } from "lucide-react";

const primaryClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border-2 border-emerald-300/50 bg-emerald-400 px-3 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_4px_20px_rgba(16,185,129,0.25)] transition hover:border-emerald-200/80 hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const secondaryClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-900/35 px-3 py-1.5 text-sm font-medium text-slate-200 shadow-sm transition hover:border-slate-500/80 hover:bg-slate-800/55 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

export function ViewPublicProfileLink({
  slug,
  isVerified = true,
  variant = "secondary",
}: {
  slug?: string | null;
  /** Public profile is only live for verified doctors. */
  isVerified?: boolean;
  variant?: "primary" | "secondary";
}) {
  if (!slug || !isVerified) return null;

  return (
    <Link
      href={`/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className={variant === "primary" ? primaryClass : secondaryClass}
    >
      View Public Profile
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
    </Link>
  );
}

