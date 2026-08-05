import type { ReactNode } from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { specialtyToSlug } from "@/lib/finder-seo";

/** Island-wide Finder results for a specialty (`/finder/all/gynecology`). */
export function finderSpecialtyPath(specialty: string): string {
  const slug = specialtyToSlug(specialty);
  if (!slug || slug === "all") return "/finder";
  return `/finder/all/${slug}`;
}

type FinderSpecialtyLinkProps = {
  specialty: string;
  className?: string;
  children?: ReactNode;
};

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
    <PendingLink
      href={finderSpecialtyPath(label)}
      prefetch={false}
      className={className}
    >
      {children ?? label}
    </PendingLink>
  );
}
