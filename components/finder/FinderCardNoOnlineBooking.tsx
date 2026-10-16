import { finderCardTimesAreaClass } from "@/components/finder/finder-availability-layout";
import { FinderCardWeek } from "@/components/finder/FinderCardWeek";
import { FINDER_CARD_NO_ONLINE_BOOKING } from "@/lib/finder-profile-card";

/**
 * A clinic where she takes no online bookings: paused there, or her access ended. One
 * sentence for both (user, 2026-10-16); the Call button sits with the clinic beside it.
 */
export function FinderCardNoOnlineBooking() {
  return (
    <section aria-label="Times" className={finderCardTimesAreaClass}>
      <FinderCardWeek days={null} />
      <div data-testid="finder-card-booking-paused" className="mt-4 max-w-[470px]">
        <p className="text-base font-bold text-profile-text">{FINDER_CARD_NO_ONLINE_BOOKING.title}</p>
        <p className="mt-1 text-sm text-profile-muted">{FINDER_CARD_NO_ONLINE_BOOKING.body}</p>
      </div>
    </section>
  );
}
