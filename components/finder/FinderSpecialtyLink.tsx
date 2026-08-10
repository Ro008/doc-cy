import type { ReactNode } from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL } from "@/lib/doctor-specialty-public";
import { finderResultsPath } from "@/lib/finder-public-path";
import { normalizeDistrictForSeoTitle } from "@/lib/doctor-seo-formatting";

/** Island-wide Finder results for a specialty (`/all/gynecology`). */
export function finderSpecialtyPath(specialty: string): string {
  return finderResultsPath(null, specialty);
}

type FinderSpecialtyLinkProps = {
  specialty: string;
  /** When set, links to `/{district}/{specialty}` instead of `/all/{specialty}`. */
  district?: string | null;
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
  district = null,
  className,
  children,
}: FinderSpecialtyLinkProps) {
  const label = specialty.trim();
  if (
    !label ||
    label === "Specialty not set" ||
    label === PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL
  ) {
    return <span className={className}>{children ?? label}</span>;
  }

  const districtLabel = normalizeDistrictForSeoTitle(district);

  return (
    <PendingLink
      href={finderResultsPath(districtLabel, label)}
      prefetch={false}
      className={className}
    >
      {children ?? label}
    </PendingLink>
  );
}

type FinderDistrictLinkProps = {
  district: string;
  className?: string;
  children?: ReactNode;
};

/**
 * District → public finder results for that district (`/paphos`).
 * Renders plain text when the value is not a known Cyprus district.
 */
export function FinderDistrictLink({
  district,
  className,
  children,
}: FinderDistrictLinkProps) {
  const districtLabel = normalizeDistrictForSeoTitle(district);
  if (!districtLabel) {
    return <span className={className}>{children ?? district.trim()}</span>;
  }

  return (
    <PendingLink
      href={finderResultsPath(districtLabel, null)}
      prefetch={false}
      className={className}
    >
      {children ?? districtLabel}
    </PendingLink>
  );
}
