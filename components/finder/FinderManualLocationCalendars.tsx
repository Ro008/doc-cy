import { FinderCardClinicColumn } from "@/components/finder/FinderCardClinicColumn";
import { FinderClinicLocationBlock, type FinderClinicRef } from "@/components/finder/FinderClinicLocationBlock";
import { FinderListingRequestBox } from "@/components/finder/FinderListingRequestBox";
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
  // G's listing card (Finder G, step 4; user, 2026-10-16): one clinic, then "Not on online
  // booking yet" with the vote button; no calendar of invented times. Two grid cells.
  if (layoutVariant === "finder") {
    const clinic = locations[0] ?? null;
    const clinicId = String(clinic?.id ?? "").trim();
    return (
      <>
        <FinderCardClinicColumn
          clinic={clinic}
          address={
            String(clinic?.address ?? "").trim() ||
            String(listing.address ?? "").trim() ||
            String(clinic?.district ?? "").trim() ||
            listing.district
          }
          mapsHref={
            String(clinic?.addressMapsLink ?? "").trim() ||
            String(listing.address_maps_link ?? "").trim() ||
            null
          }
          phone={
            clinicId && clinic?.hasPhone
              ? { clinicId, manualId: listing.id, variant: "call-to-book" }
              : null
          }
        />
        <FinderListingRequestBox
          manualId={listing.id}
          clinicId={clinic?.id}
          requestSource={callToBookSource}
          requestCount={listing.monthlyRequestCount}
        />
      </>
    );
  }
  const isMulti = locations.length > 1;
  // The listing page: the requests badge above its preview calendar.
  const calendarClass = "flex min-w-0 flex-col gap-2";
  const badge = (show: boolean) =>
    show ? (
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
                  requestCount={null}
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
                  requestCount={null}
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
