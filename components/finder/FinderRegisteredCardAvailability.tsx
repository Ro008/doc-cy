import { FinderCardClinicColumn } from "@/components/finder/FinderCardClinicColumn";
import { FinderCardDayStrip } from "@/components/finder/FinderCardDayStrip";
import { FinderCardNoOnlineBooking } from "@/components/finder/FinderCardNoOnlineBooking";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import { buildMapsUrlFromClinicLocation } from "@/lib/clinic-info";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";
import { finderCardOpeningHours } from "@/lib/finder-profile-card";
import { loadFinderAvailabilityForRequest } from "@/lib/public/load-finder-availability-request";
import { clinicForRenderedLocation } from "@/lib/public/finder-card-clinic-match";
import { loadFinderRegisteredClinics } from "@/lib/public/load-finder-registered-clinics";
import { finderCardTimesAreaClass } from "@/components/finder/finder-availability-layout";

const registeredFinderCallClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-profile-muted px-3.5 text-sm font-bold text-profile-text transition-none hover:border-accent disabled:cursor-wait disabled:opacity-60";

/** While the card's clinic and times load: the week and the clinic, at their size. */
export function FinderCardAvailabilitySkeleton() {
  return (
    <>
      <div className={finderCardTimesAreaClass} data-testid="finder-card-calendar-skeleton" aria-hidden>
        <div className="h-[60px] max-w-[470px] animate-pulse rounded-2xl bg-accent-soft" />
        <div className="mt-3.5 h-[136px] max-w-[470px] animate-pulse rounded-2xl bg-profile-bg" />
      </div>
      <div className="min-w-0 space-y-2 border-t border-profile-border pt-4 lg:border-t-0 lg:pt-0" aria-hidden>
        <div className="h-5 w-2/3 animate-pulse rounded bg-profile-bg" />
        <div className="h-10 w-full animate-pulse rounded bg-profile-bg" />
        <div className="h-11 w-1/2 animate-pulse rounded-xl bg-profile-bg" />
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
 * The registered card under the hero (mockup L; user, 2026-10-16): the clinic's week and
 * times (or one sentence when it takes no online bookings: paused there, or her access
 * ended) beside the clinic as her profile shows it. Two grid cells, so the card's body
 * grid places them.
 */
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

  return (
    <>
      {paused || !calendar || !profileSlug ? (
        <FinderCardNoOnlineBooking />
      ) : (
        <FinderCardDayStrip calendar={calendar} profileSlug={profileSlug} locationId={location?.id ?? null} />
      )}
      <FinderCardClinicColumn
        clinic={clinic}
        address={address}
        mapsHref={mapsHref}
        hours={finderCardOpeningHours(location)}
        phone={clinicId && clinic?.hasPhone ? { clinicId, manualId: doctorId, variant: "show-phone-number" } : null}
      />
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
      revealedClassName={`${registeredFinderCallClass} tabular-nums`}
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
