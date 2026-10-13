import { Clock, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import { PendingLink } from "@/components/navigation/PendingLink";
import type { BookingPanelClinic } from "@/lib/public/profile-booking-panel";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";

type Props = {
  slug: string;
  professionalId: string;
  clinics: readonly BookingPanelClinic[];
  /** The times of the chosen clinic (or the note a signed-in professional sees). */
  children: React.ReactNode;
};

/**
 * The booking panel (user, 2026-10-13): choose a clinic, see that clinic's address, hours,
 * phone and map, then its times. On a wide screen it sits on the right and stays on screen
 * while the page scrolls (scrolling inside itself when it is taller than the screen); on a
 * phone it is the first thing under the hero. Choosing a clinic is a link (`?location=`),
 * so the server draws that clinic's times.
 */
export async function ProfileBookingPanel({ slug, professionalId, clinics, children }: Props) {
  const t = await getTranslations("DoctorProfilePage");
  const bookingT = await getTranslations("BookingPage");
  const locale = await getLocale();
  const several = clinics.length > 1;

  const details = (clinic: BookingPanelClinic) => (
    <div className="mt-3 flex flex-col gap-2.5">
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
  );

  const heading = (clinic: BookingPanelClinic) => (
    <span className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 font-extrabold text-profile-text">{clinic.title}</span>
      {clinic.place ? <span className="shrink-0 text-sm font-medium text-profile-muted">{clinic.place}</span> : null}
    </span>
  );

  return (
    <aside
      id={PROFILE_SECTION_IDS.book}
      aria-labelledby="profile-booking-panel-heading"
      data-testid="profile-booking-panel"
      className="min-w-0 scroll-mt-20 rounded-3xl border border-profile-border bg-profile-surface text-profile-body shadow-lg shadow-black/5 lg:sticky lg:top-[4.5rem] lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:[scrollbar-width:thin]"
    >
      <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        <h2 id="profile-booking-panel-heading" className="text-xl font-extrabold tracking-tight text-profile-text">
          {bookingT("title")}
        </h2>

        {clinics.length > 0 ? (
          <div data-testid="profile-clinic-picker">
            {several ? (
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-profile-muted">
                {bookingT("chooseClinicHeading")}
              </p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {clinics.map((clinic) =>
                clinic.selected ? (
                  <li
                    key={clinic.id}
                    aria-current="true"
                    data-testid="profile-clinic-selected"
                    className={`rounded-2xl p-3.5 ${several ? "border-2 border-accent bg-accent-soft" : "border border-profile-border"}`}
                  >
                    {heading(clinic)}
                    {clinic.bookingOff && several ? (
                      <p className="mt-1 text-xs font-bold text-profile-muted">{bookingT("onlineBookingOff")}</p>
                    ) : null}
                    {details(clinic)}
                  </li>
                ) : (
                  <li key={clinic.id}>
                    <PendingLink
                      href={`/${locale}/${slug}?location=${encodeURIComponent(clinic.id)}`}
                      scroll={false}
                      fill
                      className="w-full rounded-2xl border-2 border-profile-border px-3.5 py-3 text-left transition hover:border-accent"
                    >
                      <span className="block w-full text-left">
                        {heading(clinic)}
                        {clinic.bookingOff ? (
                          <span className="mt-1 block text-xs font-bold text-profile-muted">
                            {bookingT("onlineBookingOff")}
                          </span>
                        ) : null}
                      </span>
                    </PendingLink>
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : null}

        {children}
      </div>
    </aside>
  );
}
