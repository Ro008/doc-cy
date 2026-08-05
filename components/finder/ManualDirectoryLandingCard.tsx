"use client";

import { PendingLink } from "@/components/navigation/PendingLink";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderClinicLocationBlock } from "@/components/finder/FinderClinicLocationBlock";
import { FinderSpecialtyLink } from "@/components/finder/FinderSpecialtyLink";
import {
  ManualDirectoryDoctorClaimFooter,
  ManualDirectoryMonthlyRequestBadge,
  ManualDirectoryReportIncorrectInfoLink,
} from "@/components/finder/ManualDirectoryPatientActions";
import { FinderManualCardAvailabilityGrid } from "@/components/finder/FinderManualCardAvailabilityGrid";
import { FinderResultsAvailabilityShell } from "@/components/finder/FinderResultsAvailabilityShell";
import {
  finderLandingCardDetailsGridClass,
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

export function ManualDirectoryLandingCard({
  row,
  dayHeaders,
}: ManualDirectoryLandingCardProps) {
  return (
    <FinderResultsAvailabilityShell dayHeaders={dayHeaders}>
      <article className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5">
        <div className={finderRegisteredCardRowClass}>
          <div
            className={`flex min-w-0 shrink-0 items-start gap-3 ${finderRegisteredIdentityColumnClass}`}
          >
            <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-ink-50 ring-2 ring-clinical-100">
              <img
                src={row.photoUrl}
                alt={`${row.displayName} profile photo`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex-1 flex flex-col items-stretch gap-2 text-left">
              <p className="text-[17px] font-bold leading-[1.2] tracking-tight text-ink-900">
                {row.displayName}
              </p>
              <FinderSpecialtyLink
                specialty={row.specialty}
                className="-ml-2 inline-flex max-w-full items-center self-start rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-600 transition-none hover:border-clinical-300 hover:bg-clinical-50 hover:text-clinical-800"
              >
                <span className="whitespace-normal break-words leading-snug">
                  {row.specialty}
                </span>
              </FinderSpecialtyLink>
              {row.isGesy ? (
                <div className="self-start">
                  <GesyProviderBadge size="sm" language="el" />
                </div>
              ) : null}
            </div>
          </div>

          <div className={finderRegisteredDetailsSectionClass}>
            <div className={finderLandingCardDetailsGridClass}>
              <div className="min-w-0 space-y-4">
                <FinderClinicLocationBlock
                  district={row.district}
                  address={row.address}
                  addressMapsLink={row.address_maps_link}
                  clinic={row.clinic}
                />
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
                  addressText={row.address}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className={`${finderCardManualFooterClass} flex flex-wrap items-end justify-between gap-x-4 gap-y-2`}
        >
          <ManualDirectoryDoctorClaimFooter />
          <ManualDirectoryReportIncorrectInfoLink
            displayName={row.displayName}
            specialty={row.specialty}
            district={row.district}
            className="ml-auto shrink-0 text-right"
          />
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
