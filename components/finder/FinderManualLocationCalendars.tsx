import { FinderClinicLocationBlock, type FinderClinicRef } from "@/components/finder/FinderClinicLocationBlock";
import { FinderManualCardAvailabilityGrid } from "@/components/finder/FinderManualCardAvailabilityGrid";
import { FinderMultiLocationAvailability } from "@/components/finder/FinderMultiLocationAvailability";
import { ManualDirectoryMonthlyRequestBadge } from "@/components/finder/ManualDirectoryPatientActions";
import type { CallToBookSource } from "@/lib/call-to-book";
import { manualPreviewSeedKey } from "@/lib/finder-manual-preview-calendar";
import { formatClinicCountLabel } from "@/lib/manual-directory-clinics";
import type { FinderAvailabilityDayHeader } from "@/lib/public/compute-public-booking-slots";

export type FinderManualLocationListing = {
  id: string;
  district: string;
  address?: string | null;
  address_maps_link?: string | null;
  hasPhone: boolean;
  clinic?: FinderClinicRef | null;
  clinics?: readonly FinderClinicRef[] | null;
  monthlyRequestCount: number;
};

type Props = {
  listing: FinderManualLocationListing;
  dayHeaders: readonly FinderAvailabilityDayHeader[];
  callToBookSource: CallToBookSource;
  layoutVariant?: "finder" | "landing";
  anchorStickyWeekNav?: boolean;
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
  anchorStickyWeekNav = false,
}: Props) {
  const locations = listingLocations(listing);
  const isMulti = locations.length > 1;
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
                  listingHasPhone: listing.hasPhone,
                  source: callToBookSource,
                }}
              />
            ),
            calendar: (
              <div className="flex min-w-0 flex-col gap-2">
                {index === 0 ? (
                  <ManualDirectoryMonthlyRequestBadge
                    monthlyRequestCount={listing.monthlyRequestCount}
                  />
                ) : null}
                <FinderManualCardAvailabilityGrid
                  manualId={listing.id}
                  seedKey={
                    isMulti ? manualPreviewSeedKey(listing.id, locationKey) : listing.id
                  }
                  clinicId={clinic.id}
                  requestSource={callToBookSource}
                  dayHeaders={[...dayHeaders]}
                  anchorStickyWeekNav={anchorStickyWeekNav && index === 0}
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
                  listingHasPhone: listing.hasPhone,
                  source: callToBookSource,
                }}
              />
            ),
            calendar: (
              <div className="flex min-w-0 flex-col gap-2">
                <ManualDirectoryMonthlyRequestBadge
                  monthlyRequestCount={listing.monthlyRequestCount}
                />
                <FinderManualCardAvailabilityGrid
                  manualId={listing.id}
                  clinicId={listing.clinic?.id}
                  requestSource={callToBookSource}
                  dayHeaders={[...dayHeaders]}
                  anchorStickyWeekNav={anchorStickyWeekNav}
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
