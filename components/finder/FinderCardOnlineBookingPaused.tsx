import { Pause } from "lucide-react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { finderCardCalendarAreaClass } from "@/components/finder/finder-availability-layout";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";

type Props = {
  profileSlug: string;
  /** When true, copy refers to this clinic only — not the whole practice. */
  locationScoped?: boolean;
  /** Another of the professional's clinics that takes online bookings, when there is one. */
  openClinicName?: string | null;
};

/**
 * G's paused box (Finder G, step 4; user, 2026-10-16): online booking is off here, and
 * where it is on. The button opens the profile; the profile pop-up comes in step 5.
 */
export function FinderCardOnlineBookingPaused({
  profileSlug,
  locationScoped = false,
  openClinicName = null,
}: Props) {
  const otherClinic = String(openClinicName ?? "").trim();
  return (
    <div className={finderCardCalendarAreaClass}>
      <div
        data-testid="finder-card-booking-paused"
        className="flex flex-1 flex-wrap items-center gap-3.5 rounded-2xl bg-site-ink-50 p-4"
      >
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-site-clinical-100 text-site-clinical-800"
        >
          <Pause className="h-4 w-4 fill-current" />
        </div>
        <div className="min-w-0 flex-[1_1_220px]">
          <p className="text-[15px] font-bold text-site-ink-900">
            {locationScoped ? "Online booking is paused at this clinic" : "Online booking is paused"}
          </p>
          <p className="mt-1 text-[13px] text-site-ink-500">
            {otherClinic ? (
              <>Online booking is open at {openClinicName}.</>
            ) : (
              "The profile has the clinic's details and other ways to get in touch."
            )}
          </p>
        </div>
        <PendingLink
          href={publicProfessionalProfilePath(profileSlug)}
          navigationReason="profile"
          className="inline-flex min-h-[40px] items-center rounded-xl border border-site-ink-200 bg-site-white px-3.5 text-sm font-bold text-site-clinical-700 transition-none hover:border-site-clinical-300"
        >
          {otherClinic ? "Book at the other clinic" : "View profile"}
        </PendingLink>
      </div>
    </div>
  );
}
