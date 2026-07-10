import { PendingLink } from "@/components/navigation/PendingLink";

type Props = {
  profileSlug: string;
};

export function FinderCardOnlineBookingPaused({ profileSlug }: Props) {
  return (
    <div
      data-testid="finder-card-booking-paused"
      className="rounded-lg border border-clinical-200 bg-clinical-50/40 px-4 py-4"
    >
      <h3 className="text-sm font-semibold text-ink-900">Online booking paused</h3>
      <p className="mt-2 text-xs leading-relaxed text-ink-600">
        This professional is not taking online bookings right now. View their profile for clinic
        details and other ways to get in touch.
      </p>
      <PendingLink
        href={`/${profileSlug}`}
        navigationReason="profile"
        className="mt-3 inline-flex text-xs font-semibold text-clinical-700 transition hover:text-clinical-600"
      >
        View profile
      </PendingLink>
    </div>
  );
}
