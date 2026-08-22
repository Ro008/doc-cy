import { PendingLink } from "@/components/navigation/PendingLink";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderSpecialtyPills } from "@/components/finder/FinderSpecialtyPills";
import {
  ManualDirectoryDoctorClaimFooter,
  ManualDirectoryReportIncorrectInfoLink,
} from "@/components/finder/ManualDirectoryPatientActions";
import { FinderManualLocationCalendars } from "@/components/finder/FinderManualLocationCalendars";
import { FinderResultsAvailabilityShell } from "@/components/finder/FinderResultsAvailabilityShell";
import { FINDER_LCP_CARD_IMAGE_PRIORITY } from "@/lib/finder-card-image-priority";
import { finderResultsPath } from "@/lib/finder-public-path";
import {
  finderRegisteredCardRowClass,
  finderRegisteredDetailsSectionClass,
  finderRegisteredIdentityColumnClass,
} from "@/components/finder/finder-availability-layout";
import {
  finderCardManualFooterActionsClass,
  finderCardManualFooterClass,
} from "@/components/finder/finder-card-cta";
import { finderResultCardClass } from "@/components/finder/finder-surface";
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
      <article className={`flex flex-col gap-4 ${finderResultCardClass}`}>
        <div className={finderRegisteredCardRowClass}>
          <div
            className={`flex min-w-0 shrink-0 items-start gap-3 ${finderRegisteredIdentityColumnClass}`}
          >
            <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-ink-50 ring-2 ring-clinical-100">
              <img
                src={row.photoUrl}
                alt={`${row.displayName} profile photo`}
                className="h-full w-full object-cover"
                {...FINDER_LCP_CARD_IMAGE_PRIORITY}
              />
            </div>
            <div className="min-w-0 flex-1 flex flex-col items-stretch gap-2 text-left">
              <p className="text-[17px] font-bold leading-[1.2] tracking-tight text-ink-900">
                {row.displayName}
              </p>
              <FinderSpecialtyPills
                specialties={row.specialties}
                specialty={row.specialty}
                district={row.district}
                className="-ml-2"
              />
              {row.isGesy ? (
                <div className="self-start">
                  <GesyProviderBadge size="sm" language="el" />
                </div>
              ) : null}
            </div>
          </div>

          <div className={finderRegisteredDetailsSectionClass}>
            <FinderManualLocationCalendars
              listing={row}
              dayHeaders={dayHeaders}
              callToBookSource="professional_profile_page"
              layoutVariant="landing"
            />
          </div>
        </div>

        <div className={`${finderCardManualFooterClass} ${finderCardManualFooterActionsClass}`}>
          <ManualDirectoryDoctorClaimFooter />
          <ManualDirectoryReportIncorrectInfoLink
            displayName={row.displayName}
            specialty={row.specialty}
            district={row.district}
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
}: ManualDirectoryLandingBrowseLinkProps) {
  return (
    <p className="text-sm text-ink-600">
      <PendingLink
        href={finderResultsPath(district, specialty)}
        className="font-medium text-clinical-700 underline-offset-2 hover:underline"
      >
        Browse all {specialty} in {district}
      </PendingLink>
    </p>
  );
}
