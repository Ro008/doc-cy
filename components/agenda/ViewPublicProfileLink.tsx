import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function ViewPublicProfileLink({
  slug,
}: {
  slug?: string | null;
}) {
  if (!slug) return null;

  return (
    <Link
      href={`/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-transparent px-4 py-2 text-sm font-medium text-slate-200/90 backdrop-blur transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
    >
      View Public Profile
      <ExternalLink className="h-4 w-4" />
    </Link>
  );
}

