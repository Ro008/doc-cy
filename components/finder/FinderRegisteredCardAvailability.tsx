import { FinderCardAvailabilityGrid } from "@/components/finder/FinderCardAvailabilityGrid";
import { FinderCardOnlineBookingPaused } from "@/components/finder/FinderCardOnlineBookingPaused";
import { loadFinderAvailabilityForRequest } from "@/lib/public/load-finder-availability-request";

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
  anchorStickyWeekNav?: boolean;
};

export async function FinderRegisteredCardAvailability({
  doctorId,
  profileSlug,
  doctorIdsKey,
  anchorStickyWeekNav = false,
}: FinderRegisteredCardAvailabilityProps) {
  const { paused, calendars } = await loadFinderAvailabilityForRequest(doctorIdsKey);
  if (paused.get(doctorId)) {
    return (
      <div className="min-w-0">
        <FinderCardOnlineBookingPaused profileSlug={profileSlug} />
      </div>
    );
  }

  const calendar = calendars.get(doctorId);
  if (!calendar || calendar.days.length === 0 || !profileSlug) return null;

  return (
    <div className="min-w-0">
      <FinderCardAvailabilityGrid
        calendar={calendar}
        profileSlug={profileSlug}
        anchorStickyWeekNav={anchorStickyWeekNav}
      />
    </div>
  );
}
