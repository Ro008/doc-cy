import { FinderCardAvailabilityGrid } from "@/components/finder/FinderCardAvailabilityGrid";
import { FinderCardOnlineBookingPaused } from "@/components/finder/FinderCardOnlineBookingPaused";
import { FinderMultiLocationAvailability } from "@/components/finder/FinderMultiLocationAvailability";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import { buildMapsUrlFromClinicLocation } from "@/lib/clinic-info";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";
import { loadFinderAvailabilityForRequest } from "@/lib/public/load-finder-availability-request";
import { loadFinderRegisteredPublicCallIds } from "@/lib/public/load-finder-registered-public-call";
import { doctorLocationDisplayName } from "@/lib/doctor-locations";
import { formatClinicCountLabel } from "@/lib/manual-directory-clinics";

const registeredFinderCallClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-clinical-200 bg-clinical-50 px-3 py-1.5 text-xs font-semibold text-clinical-800 transition-none hover:border-clinical-300 hover:bg-clinical-100 disabled:cursor-wait disabled:opacity-60";

const registeredFinderCallRevealedClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-clinical-200 bg-clinical-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-clinical-800 transition-none hover:border-clinical-300 hover:bg-clinical-100";

export function FinderCardAvailabilitySkeleton() {
  return (
    <div
      className="min-w-0"
      data-testid="finder-card-calendar-skeleton"
      aria-hidden
    >
      <div className="h-[148px] animate-pulse rounded-lg border border-ink-200 bg-ink-50" />
    </div>
  );
}

type FinderRegisteredCardAvailabilityProps = {
  doctorId: string;
  profileSlug: string;
  doctorIdsKey: string;
  /** Fallback address when locations have not been loaded yet. */
  clinicAddress?: string | null;
  anchorStickyWeekNav?: boolean;
};

export async function FinderRegisteredCardAvailability({
  doctorId,
  profileSlug,
  doctorIdsKey,
  clinicAddress = null,
  anchorStickyWeekNav = false,
}: FinderRegisteredCardAvailabilityProps) {
  const [batch, publicCallIds] = await Promise.all([
    loadFinderAvailabilityForRequest(doctorIdsKey),
    loadFinderRegisteredPublicCallIds(doctorIdsKey),
  ]);
  const locations = batch.locationsByDoctorId.get(doctorId) ?? [];
  const isMulti = locations.length > 1;
  const callDoctorId = publicCallIds.has(doctorId) ? doctorId : null;

  if (locations.length === 0) {
    if (batch.paused.get(doctorId)) {
      return (
        <FinderMultiLocationAvailability
          rows={[
            {
              key: doctorId,
              location: (
                <RegisteredLocationCopy
                  address={clinicAddress}
                  callDoctorId={callDoctorId}
                />
              ),
              calendar: <FinderCardOnlineBookingPaused profileSlug={profileSlug} />,
            },
          ]}
        />
      );
    }
    const calendar = batch.calendars.get(doctorId);
    if (!calendar || calendar.days.length === 0 || !profileSlug) {
      return (
        <FinderMultiLocationAvailability
          rows={[
            {
              key: doctorId,
              location: (
                <RegisteredLocationCopy
                  address={clinicAddress}
                  callDoctorId={callDoctorId}
                />
              ),
              calendar: null,
            },
          ]}
        />
      );
    }
    return (
      <FinderMultiLocationAvailability
        rows={[
          {
            key: doctorId,
            location: (
              <RegisteredLocationCopy
                address={clinicAddress}
                callDoctorId={callDoctorId}
              />
            ),
            calendar: (
              <FinderCardAvailabilityGrid
                calendar={calendar}
                profileSlug={profileSlug}
                anchorStickyWeekNav={anchorStickyWeekNav}
              />
            ),
          },
        ]}
      />
    );
  }

  const rows = locations.map((location, index) => {
    const availability = batch.byLocationId.get(location.id);
    const address =
      String(location.clinic_address ?? "").trim() ||
      (index === 0 ? clinicAddress : null);
    const locationScopedPause = isMulti;
    const calendarNode = availability?.paused
      ? (
          <FinderCardOnlineBookingPaused
            profileSlug={profileSlug}
            locationScoped={locationScopedPause}
          />
        )
      : availability?.calendar && availability.calendar.days.length > 0 && profileSlug
        ? (
            <FinderCardAvailabilityGrid
              calendar={availability.calendar}
              profileSlug={profileSlug}
              locationId={isMulti ? location.id : null}
              anchorStickyWeekNav={anchorStickyWeekNav && index === 0}
            />
          )
        : null;

    return {
      key: location.id,
      location: (
        <RegisteredLocationCopy
          address={address}
          latitude={location.latitude}
          longitude={location.longitude}
          placeId={location.clinic_place_id}
          title={
            isMulti
              ? doctorLocationDisplayName(location, index, locations.length)
              : null
          }
          callDoctorId={index === 0 ? callDoctorId : null}
        />
      ),
      calendar: calendarNode,
    };
  });

  return (
    <FinderMultiLocationAvailability
      countLabel={isMulti ? formatClinicCountLabel(locations.length) : null}
      rows={rows}
    />
  );
}

function RegisteredPublicCallButton({ doctorId }: { doctorId: string }) {
  return (
    <RevealPhoneButton
      kind="registered"
      id={doctorId}
      hasPhone
      variant="show-phone-number"
      className={registeredFinderCallClass}
      revealedClassName={registeredFinderCallRevealedClass}
    />
  );
}

/** Address-only registered cards (no slug / no calendar column) still get the opted-in Call. */
export async function FinderRegisteredPublicCall({
  doctorId,
  doctorIdsKey,
}: {
  doctorId: string;
  doctorIdsKey: string;
}) {
  const publicCallIds = await loadFinderRegisteredPublicCallIds(doctorIdsKey);
  if (!publicCallIds.has(doctorId)) return null;
  return (
    <div className="mt-1.5">
      <RegisteredPublicCallButton doctorId={doctorId} />
    </div>
  );
}

function RegisteredLocationCopy({
  address,
  title,
  callDoctorId = null,
  latitude = null,
  longitude = null,
  placeId = null,
}: {
  address?: string | null;
  title?: string | null;
  callDoctorId?: string | null;
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
          {title}
        </p>
      ) : null}
      <div>
        <p className="text-xs leading-relaxed text-ink-600 whitespace-pre-wrap break-words">
          {displayAddress || "Not provided yet"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-xs font-semibold text-clinical-700 transition-none underline-offset-2 hover:text-clinical-600 hover:underline"
            >
              Open in Maps ↗
            </a>
          ) : null}
          {callDoctorId ? <RegisteredPublicCallButton doctorId={callDoctorId} /> : null}
        </div>
      </div>
    </div>
  );
}
