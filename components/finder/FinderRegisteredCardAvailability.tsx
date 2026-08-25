import { FinderCardAvailabilityGrid } from "@/components/finder/FinderCardAvailabilityGrid";
import { FinderCardOnlineBookingPaused } from "@/components/finder/FinderCardOnlineBookingPaused";
import { FinderMultiLocationAvailability } from "@/components/finder/FinderMultiLocationAvailability";
import { loadFinderAvailabilityForRequest } from "@/lib/public/load-finder-availability-request";
import { doctorLocationDisplayName } from "@/lib/doctor-locations";
import { formatClinicCountLabel } from "@/lib/manual-directory-clinics";
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
  const batch = await loadFinderAvailabilityForRequest(doctorIdsKey);
  const locations = batch.locationsByDoctorId.get(doctorId) ?? [];
  const isMulti = locations.length > 1;

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
          title={
            isMulti
              ? doctorLocationDisplayName(location, index, locations.length)
              : null
          }
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

function RegisteredLocationCopy({
  address,
  title,
}: {
  address?: string | null;
  title?: string | null;
}) {
  return (
    <div className="space-y-4">
      {title ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
          {title}
        </p>
      ) : null}
      <div>
        <p className="text-xs leading-relaxed text-ink-600 whitespace-pre-wrap break-words">
          {String(address ?? "").trim() || "Not provided yet"}
        </p>
      </div>
    </div>
  );
}
