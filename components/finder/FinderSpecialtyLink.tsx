import type { ReactNode } from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
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
 * Specialty → public finder results.
 * Uses PendingLink so the clicked specialty shows loading and ignores double-clicks;
 * public `/all/...` paths hard-navigate via PendingLink.
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
    <PendingLink href={finderSpecialtyPath(label)} prefetch={false} className={className}>
      {children ?? label}
    </PendingLink>
  );
}
