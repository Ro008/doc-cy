import { Clock, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import type { BookingPanelClinic } from "@/lib/public/profile-booking-panel";

type Props = {
  professionalId: string;
  /** The clinic being booked; null when she has none. */
  clinic: BookingPanelClinic | null;
  /** She has several clinics: say which one this is. */
  several: boolean;
  /** The clinic's calendar and times (or the note a signed-in professional sees). */
  children: React.ReactNode;
};

/**
 * The clinic card in the booking column (user, 2026-10-13): one clinic at a time, with its
 * address, opening hours, phone and map, then its calendar and times. Which clinic is
 * chosen above it, in "Choose a clinic".
 */
export async function ProfileBookingPanel({ professionalId, clinic, several, children }: Props) {
  const t = await getTranslations("DoctorProfilePage");
  const bookingT = await getTranslations("BookingPage");

  return (
    <section
      aria-labelledby={clinic ? "profile-booking-clinic-heading" : undefined}
      data-testid="profile-booking-panel"
      className="min-w-0 rounded-3xl border border-profile-border bg-profile-surface text-profile-body shadow-lg shadow-black/5"
    >
      <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        {clinic ? (
          <div data-testid="profile-clinic-selected">
            {several && !clinic.bookingOff ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-profile-muted">
                {bookingT("bookingAtClinic")}
              </p>
            ) : null}
            <h2
              id="profile-booking-clinic-heading"
              className="text-lg font-extrabold leading-snug tracking-tight text-profile-text"
            >
              {clinic.title}
            </h2>
            <div className="mt-2.5 flex flex-col gap-2.5">
              {clinic.address ? (
                <p className="flex items-start gap-2 text-sm text-profile-body">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-link" aria-hidden />
                  <span>{clinic.address}</span>
                </p>
              ) : null}
              {clinic.hours.length > 0 ? (
                <div data-testid="profile-clinic-hours" className="flex items-start gap-2 text-sm text-profile-body">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-link" aria-hidden />
                  <dl aria-label={t("openingHoursLabel")} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                    {clinic.hours.map((row) => (
                      <div key={row.days} className="contents">
                        <dt className="font-semibold text-profile-text">{row.days}</dt>
                        <dd className="tabular-nums">{row.hours}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
              {clinic.phoneClinicId || clinic.mapsUrl ? (
                <div className="mt-0.5 flex flex-wrap gap-2">
                  {clinic.phoneClinicId ? (
                    <RevealPhoneButton
                      kind="clinic"
                      id={clinic.phoneClinicId}
                      manualId={professionalId}
                      hasPhone
                      variant="profile-call"
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-bold text-accent-on transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                      revealedClassName="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-bold tabular-nums text-accent-on transition hover:opacity-90"
                    />
                  ) : null}
                  {clinic.mapsUrl ? (
                    <a
                      href={clinic.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center rounded-xl border-2 border-profile-muted px-3.5 text-sm font-bold text-profile-text transition hover:border-accent"
                    >
                      {t("openInMaps")}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={clinic ? "border-t border-profile-border pt-4" : undefined}>{children}</div>
      </div>
    </section>
  );
}
