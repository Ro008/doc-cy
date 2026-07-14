"use client";

import { PendingLink } from "@/components/navigation/PendingLink";
import {
  ManualDirectoryDoctorClaimFooter,
  ManualDirectoryMonthlyRequestBadge,
  ManualDirectoryReportIncorrectInfoLink,
} from "@/components/finder/ManualDirectoryPatientActions";
import { FinderManualCardAvailabilityGrid } from "@/components/finder/FinderManualCardAvailabilityGrid";
import { FinderResultsAvailabilityShell } from "@/components/finder/FinderResultsAvailabilityShell";
import {
  finderRegisteredCardDetailsGridClass,
  finderRegisteredCardRowClass,
  finderRegisteredDetailsSectionClass,
  finderRegisteredIdentityColumnClass,
} from "@/components/finder/finder-availability-layout";
import { finderCardManualFooterClass } from "@/components/finder/finder-card-cta";
import type { ManualDirectoryLandingRow } from "@/lib/load-manual-directory-by-slug";
import type { FinderAvailabilityDayHeader } from "@/lib/public/compute-public-booking-slots";

type ManualDirectoryLandingCardProps = {
  row: ManualDirectoryLandingRow;
  dayHeaders: FinderAvailabilityDayHeader[];
};

function getInitials(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "DR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function ManualDirectoryLandingCard({
  row,
  dayHeaders,
}: ManualDirectoryLandingCardProps) {
  return (
    <FinderResultsAvailabilityShell dayHeaders={dayHeaders} showWeekNav={false}>
      <article className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5">
        <div className={finderRegisteredCardRowClass}>
          <div
            className={`flex min-w-0 shrink-0 items-start gap-3 ${finderRegisteredIdentityColumnClass}`}
          >
            <div
              className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border bg-ink-50 ring-2 ${
                row.photoUrl
                  ? "border-clinical-200 ring-clinical-100"
                  : "border-ink-200 ring-ink-100"
              }`}
            >
              {row.photoUrl ? (
                <img
                  src={row.photoUrl}
                  alt={`${row.displayName} profile photo`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-sm font-semibold text-ink-600">
                    {getInitials(row.displayName)}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold leading-[1.2] tracking-tight text-ink-900">
                {row.displayName}
              </p>
              <p className="mt-2 -ml-2 inline-flex max-w-full items-center rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-600">
                <span className="whitespace-normal break-words text-center leading-snug">
                  {row.specialty}
                </span>
              </p>
            </div>
          </div>

          <div className={finderRegisteredDetailsSectionClass}>
            <div className={finderRegisteredCardDetailsGridClass}>
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                    Location
                  </p>
                  <p className="mb-1.5 text-xs font-medium text-ink-500">{row.district}</p>
                  <p className="mt-2.5">
                    <ManualDirectoryReportIncorrectInfoLink
                      displayName={row.displayName}
                      specialty={row.specialty}
                      district={row.district}
                    />
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <ManualDirectoryMonthlyRequestBadge
                  monthlyRequestCount={row.monthlyRequestCount}
                />
                <FinderManualCardAvailabilityGrid
                  manualId={row.id}
                  doctorName={row.displayName}
                  addressMapsLink={row.address_maps_link}
                  phone={row.phone}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={finderCardManualFooterClass}>
          <ManualDirectoryDoctorClaimFooter />
        </div>
      </article>
    </FinderResultsAvailabilityShell>
  );
}

type ManualDirectoryLandingBrowseLinkProps = {
  district: string;
  specialty: string;
  specialtySlug: string;
  districtSlug: string;
};

export function ManualDirectoryLandingBrowseLink({
  district,
  specialty,
  specialtySlug,
  districtSlug,
}: ManualDirectoryLandingBrowseLinkProps) {
  return (
    <p className="text-sm text-ink-600">
      <PendingLink
        href={`/finder/${districtSlug}/${specialtySlug}`}
        className="font-medium text-clinical-700 underline-offset-2 hover:underline"
      >
        Browse all {specialty} in {district}
      </PendingLink>
    </p>
  );
}
