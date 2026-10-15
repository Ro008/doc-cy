import { FinderClinicLocationBlock, type FinderClinicRef } from "@/components/finder/FinderClinicLocationBlock";
import { FinderManualCardAvailabilityGrid } from "@/components/finder/FinderManualCardAvailabilityGrid";
import { FinderMultiLocationAvailability } from "@/components/finder/FinderMultiLocationAvailability";
import { ManualDirectoryMonthlyRequestBadge } from "@/components/finder/ManualDirectoryPatientActions";
import type { CallToBookSource } from "@/lib/call-to-book";
import { manualPreviewSeedKey } from "@/lib/finder-manual-preview-calendar";
import { formatClinicCountLabel } from "@/lib/manual-directory-clinics";
import { finderCardCalendarBoxClass } from "@/components/finder/finder-availability-layout";
import type { FinderAvailabilityDayHeader } from "@/lib/public/compute-public-booking-slots";

export type FinderManualLocationListing = {
  id: string;
  district: string;
  address?: string | null;
  address_maps_link?: string | null;
  clinic?: FinderClinicRef | null;
  clinics?: readonly FinderClinicRef[] | null;
  monthlyRequestCount: number;
};

type Props = {
  listing: FinderManualLocationListing;
  dayHeaders: readonly FinderAvailabilityDayHeader[];
  callToBookSource: CallToBookSource;
  layoutVariant?: "finder" | "landing";
  /**
   * Seed of the single calendar shown. A finder card shows one clinic of a listing
   * that may have several, so it passes that clinic's seed (the one the listing
   * page uses), not the listing's.
   */
  previewSeedKey?: string | null;
};

function listingLocations(listing: FinderManualLocationListing): FinderClinicRef[] {
  if (listing.clinics && listing.clinics.length > 0) return [...listing.clinics];
  if (listing.clinic) return [listing.clinic];
  return [];
}

/**
 * One location + calendar pair per practice. Multi-clinic listings get a grey
 * divider between pairs; single-location cards keep the original 2-column layout.
 */
export function FinderManualLocationCalendars({
  listing,
  dayHeaders,
  callToBookSource,
  layoutVariant = "finder",
  previewSeedKey = null,
}: Props) {
  const locations = listingLocations(listing);
  const isMulti = locations.length > 1;
  // A finder card is one clinic at a fixed size: the requests badge goes on the preview.
  const inFinder = layoutVariant === "finder";
  const calendarClass = inFinder ? finderCardCalendarBoxClass : "flex min-w-0 flex-col gap-2";
  const badge = (show: boolean) =>
    show && !inFinder ? (
      <ManualDirectoryMonthlyRequestBadge monthlyRequestCount={listing.monthlyRequestCount} />
    ) : null;
  const rows =
    locations.length > 0
      ? locations.map((clinic, index) => {
          const locationKey = String(clinic.id ?? clinic.slug ?? index);
          return {
            key: locationKey,
            location: (
              <FinderClinicLocationBlock
                district={listing.district}
                address={index === 0 ? listing.address : null}
                addressMapsLink={index === 0 ? listing.address_maps_link : null}
                clinics={[clinic]}
                variant="full"
                callToBook={{
                  manualId: listing.id,
                  source: callToBookSource,
                }}
              />
            ),
            calendar: (
              <div className={calendarClass}>
                {badge(index === 0)}
                <FinderManualCardAvailabilityGrid
                  requestCount={inFinder && index === 0 ? listing.monthlyRequestCount : null}
                  manualId={listing.id}
                  seedKey={
                    isMulti
                      ? manualPreviewSeedKey(listing.id, locationKey)
                      : (previewSeedKey ?? listing.id)
                  }
                  clinicId={clinic.id}
                  requestSource={callToBookSource}
                  dayHeaders={[...dayHeaders]}
                />
              </div>
            ),
          };
        })
      : [
          {
            key: listing.id,
            location: (
              <FinderClinicLocationBlock
                district={listing.district}
                address={listing.address}
                addressMapsLink={listing.address_maps_link}
                clinic={listing.clinic}
                clinics={listing.clinics}
                variant="full"
                callToBook={{
                  manualId: listing.id,
                  source: callToBookSource,
                }}
              />
            ),
            calendar: (
              <div className={calendarClass}>
                {badge(true)}
                <FinderManualCardAvailabilityGrid
                  requestCount={inFinder ? listing.monthlyRequestCount : null}
                  manualId={listing.id}
                  clinicId={listing.clinic?.id}
                  requestSource={callToBookSource}
                  dayHeaders={[...dayHeaders]}
                />
              </div>
            ),
          },
        ];

  return (
    <FinderMultiLocationAvailability
      variant={layoutVariant}
      countLabel={isMulti ? formatClinicCountLabel(locations.length) : null}
      rows={rows}
    />
  );
}
