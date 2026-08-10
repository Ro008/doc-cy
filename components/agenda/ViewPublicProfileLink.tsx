import Link from "next/link";
import { ExternalLink } from "lucide-react";

const primaryClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border-2 border-clinical-300/50 bg-clinical-400 px-3 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(18,184,192,0.25),0_4px_20px_rgba(18,184,192,0.25)] transition hover:border-clinical-200/80 hover:bg-clinical-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900";

const secondaryClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-900/35 px-3 py-1.5 text-sm font-medium text-slate-200 shadow-sm transition hover:border-slate-500/80 hover:bg-slate-800/55 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900";

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

