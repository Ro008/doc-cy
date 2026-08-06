import type { ReactNode } from "react";
import { finderResultsPath } from "@/lib/finder-public-path";

/** Island-wide Finder results for a specialty (`/all/gynecology`). */
export function finderSpecialtyPath(specialty: string): string {
  return finderResultsPath(null, specialty);
}

type FinderSpecialtyLinkProps = {
  specialty: string;
  className?: string;
  children?: ReactNode;
};

/**
 * Specialty → public finder results. Uses a plain `<a>` (full document load)
 * because App Router soft-nav cannot resolve middleware-rewritten `/all/...` URLs
 * and leaves PendingLink stuck in a loading state.
 */
export function FinderSpecialtyLink({
  specialty,
  className,
  children,
}: FinderSpecialtyLinkProps) {
  const label = specialty.trim();
  if (!label || label === "Specialty not set") {
    return <span className={className}>{children ?? label}</span>;
  }

  return (
    <a href={finderSpecialtyPath(label)} className={className}>
      {children ?? label}
    </a>
  );
}
