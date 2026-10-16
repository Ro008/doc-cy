import { FinderCardAvailabilityGrid } from "@/components/finder/FinderCardAvailabilityGrid";
import { FinderCardOnlineBookingPaused } from "@/components/finder/FinderCardOnlineBookingPaused";
import { FinderMultiLocationAvailability } from "@/components/finder/FinderMultiLocationAvailability";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import { buildMapsUrlFromClinicLocation } from "@/lib/clinic-info";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";
import { loadFinderAvailabilityForRequest } from "@/lib/public/load-finder-availability-request";
import { FinderClinicNameLink } from "@/components/finder/FinderClinicLocationBlock";
import { clinicForRenderedLocation } from "@/lib/public/finder-card-clinic-match";
import { loadFinderRegisteredClinics } from "@/lib/public/load-finder-registered-clinics";
import {
  finderCardAddressClass,
  finderCardCalendarBoxClass,
  finderCardCalendarSkeletonHeightClass,
} from "@/components/finder/finder-availability-layout";

const registeredFinderCallClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-site-clinical-200 bg-site-clinical-50 px-3 py-1.5 text-xs font-semibold text-site-clinical-800 transition-none hover:border-site-clinical-300 hover:bg-site-clinical-100 disabled:cursor-wait disabled:opacity-60";

const registeredFinderCallRevealedClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-site-clinical-200 bg-site-clinical-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-site-clinical-800 transition-none hover:border-site-clinical-300 hover:bg-site-clinical-100";

export function FinderCardAvailabilitySkeleton() {
  return (
    <div
      className="min-w-0"
      data-testid="finder-card-calendar-skeleton"
      aria-hidden
    >
      <div
        className={`${finderCardCalendarSkeletonHeightClass} animate-pulse rounded-lg border border-site-ink-200 bg-site-ink-50`}
      />
    </div>
  );
}

type FinderRegisteredCardAvailabilityProps = {
  doctorId: string;
  profileSlug: string;
  doctorIdsKey: string;
  /**
   * The card's clinic (`professional_clinics.id`). A finder card shows one clinic
   * (user, 2026-10-15); null only for a professional with no clinic.
   */
  locationId: string | null;
  /** Fallback address when the location has not been loaded. */
  clinicAddress?: string | null;
};

export async function FinderRegisteredCardAvailability({
  doctorId,
  profileSlug,
  doctorIdsKey,
  locationId,
  clinicAddress = null,
}: FinderRegisteredCardAvailabilityProps) {
  const [batch, registeredClinics] = await Promise.all([
    loadFinderAvailabilityForRequest(doctorIdsKey),
    loadFinderRegisteredClinics(doctorIdsKey),
  ]);
  const linkedClinics = registeredClinics.byProfessionalId.get(doctorId) ?? [];
  const location =
    (batch.locationsByDoctorId.get(doctorId) ?? []).find((loc) => loc.id === locationId) ?? null;

  if (!location) {
    // No clinic to show: the address alone, and the professional's own pause state.
    const calendar = batch.calendars.get(doctorId);
    return (
      <FinderMultiLocationAvailability
        rows={[
          {
            key: doctorId,
            location: (
              <RegisteredLocationCopy
                address={clinicAddress}
                clinic={clinicForRenderedLocation({
                  locationId: null,
                  locationAddress: clinicAddress,
                  byLocationId: registeredClinics.byLocationId,
                  candidates: linkedClinics,
                })}
                doctorId={doctorId}
              />
            ),
            calendar: (
              <div className={finderCardCalendarBoxClass}>
                {batch.paused.get(doctorId) ? (
                  <FinderCardOnlineBookingPaused profileSlug={profileSlug} />
                ) : calendar && profileSlug ? (
                  <FinderCardAvailabilityGrid calendar={calendar} profileSlug={profileSlug} />
                ) : null}
              </div>
            ),
          },
        ]}
      />
    );
  }

  const availability = batch.byLocationId.get(location.id);
  const address = String(location.clinic_address ?? "").trim() || clinicAddress;
  const calendarNode = availability?.paused ? (
    <FinderCardOnlineBookingPaused profileSlug={profileSlug} locationScoped />
  ) : availability?.calendar && profileSlug ? (
    <FinderCardAvailabilityGrid
      calendar={availability.calendar}
      profileSlug={profileSlug}
      locationId={location.id}
    />
  ) : null;

  return (
    <FinderMultiLocationAvailability
      rows={[
        {
          key: location.id,
          location: (
            <RegisteredLocationCopy
              address={address}
              clinic={clinicForRenderedLocation({
                locationId: location.id,
                locationAddress: address,
                byLocationId: registeredClinics.byLocationId,
                candidates: linkedClinics,
              })}
              latitude={location.latitude}
              longitude={location.longitude}
              placeId={location.clinic_place_id}
              doctorId={doctorId}
            />
          ),
          calendar: <div className={finderCardCalendarBoxClass}>{calendarNode}</div>,
        },
      ]}
    />
  );
}

/**
 * The clinic's phone for one location of a registered card (user, 2026-09-29): shown
 * whenever the clinic has one, whether or not it takes online bookings.
 */
function RegisteredClinicCallButton({
  clinic,
  doctorId,
}: {
  clinic: { id?: string | null; hasPhone?: boolean } | null;
  doctorId: string;
}) {
  const clinicId = String(clinic?.id ?? "").trim();
  if (!clinicId || !clinic?.hasPhone) return null;
  return (
    <RevealPhoneButton
      kind="clinic"
      source="finder_card"
      id={clinicId}
      hasPhone
      manualId={doctorId}
      variant="show-phone-number"
      className={registeredFinderCallClass}
      revealedClassName={registeredFinderCallRevealedClass}
    />
  );
}

/** Address-only registered cards (no slug / no calendar column): the primary clinic's phone. */
export async function FinderRegisteredPublicCall({
  doctorId,
  doctorIdsKey,
}: {
  doctorId: string;
  doctorIdsKey: string;
}) {
  const registeredClinics = await loadFinderRegisteredClinics(doctorIdsKey);
  const clinic =
    (registeredClinics.byProfessionalId.get(doctorId) ?? []).find((c) => c.hasPhone) ?? null;
  if (!clinic) return null;
  return (
    <div className="mt-1.5">
      <RegisteredClinicCallButton clinic={clinic} doctorId={doctorId} />
    </div>
  );
}

function RegisteredLocationCopy({
  address,
  title,
  clinic = null,
  doctorId,
  latitude = null,
  longitude = null,
  placeId = null,
}: {
  address?: string | null;
  title?: string | null;
  /** Clinic behind this location, so the card names it as unregistered cards do. */
  clinic?: { id?: string | null; name: string; slug: string; hasPhone?: boolean } | null;
  doctorId: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
}) {
  const displayAddress = stripPlusCodePrefix(String(address ?? "").trim());
  const mapsHref = buildMapsUrlFromClinicLocation({
    address: displayAddress,
    latitude,
    longitude,
    placeId,
  });

  return (
    <div className="space-y-4">
      {title ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-site-ink-400">
          {title}
        </p>
      ) : null}
      <div>
        {clinic ? <FinderClinicNameLink name={clinic.name} slug={clinic.slug} /> : null}
        <p className={finderCardAddressClass} title={displayAddress || undefined}>
          {displayAddress || "Not provided yet"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-xs font-semibold text-site-clinical-700 transition-none underline-offset-2 hover:text-site-clinical-600 hover:underline"
            >
              Open in Maps ↗
            </a>
          ) : null}
          <RegisteredClinicCallButton clinic={clinic} doctorId={doctorId} />
        </div>
      </div>
    </div>
  );
}
