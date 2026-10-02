import { Check, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import type { ProfileClinicCard } from "@/lib/public/profile-clinic-cards";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";

type Props = {
  cards: readonly ProfileClinicCard[];
  professionalId: string;
};

/** "Clinics & contact": each place with its address, map and the clinic's phone. */
export async function ProfileClinicsSection({ cards, professionalId }: Props) {
  if (cards.length === 0) return null;
  const t = await getTranslations("DoctorProfilePage");
  const bookingT = await getTranslations("BookingPage");

  return (
    <section
      id={PROFILE_SECTION_IDS.clinics}
      aria-labelledby="profile-clinics-heading"
      className="grid scroll-mt-20 gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8"
    >
      <div>
        <h2
          id="profile-clinics-heading"
          className="text-2xl font-extrabold tracking-tight text-profile-text sm:text-[28px]"
        >
          {t("clinicsHeading")}
        </h2>
        {cards.length > 1 ? (
          <p className="mt-1.5 text-sm text-profile-muted">{t("clinicsHintSeveral")}</p>
        ) : null}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <li
            key={card.key}
            className={`flex flex-col gap-2 rounded-3xl border-2 bg-profile-surface p-5 ${
              card.isBookingHere ? "border-accent" : "border-profile-border"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-extrabold text-profile-text">{card.title}</h3>
              {card.isBookingHere ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-profile-text">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  {bookingT("bookingHere")}
                </span>
              ) : null}
            </div>
            {card.address ? (
              <p className="flex items-start gap-2 text-sm text-profile-body">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-link" aria-hidden />
                <span>{card.address}</span>
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {card.phoneClinicId ? (
                <RevealPhoneButton
                  kind="clinic"
                  id={card.phoneClinicId}
                  manualId={professionalId}
                  hasPhone
                  variant="profile-call"
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-accent px-4 text-sm font-bold text-accent-on transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                  revealedClassName="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-accent px-4 text-sm font-bold tabular-nums text-accent-on transition hover:opacity-90"
                />
              ) : null}
              {card.mapsUrl ? (
                <a
                  href={card.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-2xl border-2 border-profile-border px-4 text-sm font-bold text-profile-text transition hover:border-accent"
                >
                  {t("openInMaps")}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
