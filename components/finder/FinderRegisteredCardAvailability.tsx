import { FinderCardClinicColumn } from "@/components/finder/FinderCardClinicColumn";
import { FinderCardDayStrip } from "@/components/finder/FinderCardDayStrip";
import { FinderCardOnlineBookingPaused } from "@/components/finder/FinderCardOnlineBookingPaused";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import { buildMapsUrlFromClinicLocation } from "@/lib/clinic-info";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";
import { loadFinderAvailabilityForRequest } from "@/lib/public/load-finder-availability-request";
import { loadFinderPersonalMobileIds } from "@/lib/public/load-finder-personal-mobiles";
import { clinicForRenderedLocation } from "@/lib/public/finder-card-clinic-match";
import { loadFinderRegisteredClinics } from "@/lib/public/load-finder-registered-clinics";
import { finderCardCalendarAreaClass } from "@/components/finder/finder-availability-layout";

const registeredFinderCallClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-site-clinical-200 bg-site-clinical-50 px-3 py-1.5 text-xs font-semibold text-site-clinical-800 transition-none hover:border-site-clinical-300 hover:bg-site-clinical-100 disabled:cursor-wait disabled:opacity-60";

const registeredFinderCallRevealedClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-site-clinical-200 bg-site-clinical-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-site-clinical-800 transition-none hover:border-site-clinical-300 hover:bg-site-clinical-100";

/** While the card's clinic and times load: the clinic column and the calendar area, at their size. */
export function FinderCardAvailabilitySkeleton() {
  return (
    <>
      <div className="min-w-0 space-y-2" data-testid="finder-card-calendar-skeleton" aria-hidden>
        <div className="h-5 w-2/3 animate-pulse rounded bg-site-ink-50" />
        <div className="h-9 w-full animate-pulse rounded bg-site-ink-50" />
      </div>
      <div className={finderCardCalendarAreaClass} aria-hidden>
        <div className="flex-1 animate-pulse rounded-2xl bg-site-ink-50" />
      </div>
    </>
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

/**
 * G's registered card below the name (Finder G, step 4; user, 2026-10-16): the clinic
 * column beside the identity, then the calendar area across the card: the day circles, or
 * the paused box naming a clinic where online booking is open. Two grid cells, so the
 * card's grid places them.
 */
export async function FinderRegisteredCardAvailability({
  doctorId,
  profileSlug,
  doctorIdsKey,
  locationId,
  clinicAddress = null,
}: FinderRegisteredCardAvailabilityProps) {
  const [batch, registeredClinics, mobileIds] = await Promise.all([
    loadFinderAvailabilityForRequest(doctorIdsKey),
    loadFinderRegisteredClinics(doctorIdsKey),
    loadFinderPersonalMobileIds(doctorIdsKey),
  ]);
  const linkedClinics = registeredClinics.byProfessionalId.get(doctorId) ?? [];
  const locations = batch.locationsByDoctorId.get(doctorId) ?? [];
  const location = locations.find((loc) => loc.id === locationId) ?? null;

  const address = location
    ? String(location.clinic_address ?? "").trim() || clinicAddress
    : clinicAddress;
  const clinic = clinicForRenderedLocation({
    locationId: location?.id ?? null,
    locationAddress: address,
    byLocationId: registeredClinics.byLocationId,
    candidates: linkedClinics,
  });
  const clinicId = String(clinic?.id ?? "").trim();
  const mapsHref = buildMapsUrlFromClinicLocation({
    address: stripPlusCodePrefix(String(address ?? "").trim()),
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    placeId: location?.clinic_place_id ?? null,
  });

  const availability = location ? batch.byLocationId.get(location.id) : null;
  const paused = location ? Boolean(availability?.paused) : Boolean(batch.paused.get(doctorId));
  const calendar = location ? availability?.calendar : batch.calendars.get(doctorId);
  // Where she does take online bookings, for the paused box.
  const openLocation = paused
    ? locations.find((loc) => {
        if (loc.id === location?.id) return false;
        const other = batch.byLocationId.get(loc.id);
        return Boolean(other && !other.paused && other.calendar);
      })
    : null;
  const openClinicName = openLocation
    ? registeredClinics.byLocationId.get(openLocation.id)?.name ?? null
    : null;

  return (
    <>
      <FinderCardClinicColumn
        clinic={clinic}
        address={address}
        mapsHref={mapsHref}
        phone={
          clinicId && clinic?.hasPhone
            ? { clinicId, manualId: doctorId, variant: "show-phone-number" }
            : null
        }
        mobileProfessionalId={mobileIds.has(doctorId) ? doctorId : null}
      />
      {paused ? (
        <FinderCardOnlineBookingPaused
          profileSlug={profileSlug}
          locationScoped={Boolean(location)}
          openClinicName={openClinicName}
        />
      ) : calendar && profileSlug ? (
        <FinderCardDayStrip calendar={calendar} profileSlug={profileSlug} locationId={location?.id ?? null} />
      ) : (
        <div className={finderCardCalendarAreaClass} />
      )}
    </>
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
