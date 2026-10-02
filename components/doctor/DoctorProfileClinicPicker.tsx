import { Check, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PendingLink } from "@/components/navigation/PendingLink";
import {
  clinicAddressFirstLine,
  clinicTitleOrFallback,
} from "@/lib/doctor-locations";

export type ProfileClinicChoice = {
  id: string;
  label?: string | null;
  district: string | null;
  clinic_address: string | null;
  town: string | null;
  pause_online_bookings: boolean;
};

type Props = {
  slug: string;
  clinics: readonly ProfileClinicChoice[];
  selectedId: string | null;
};

export async function DoctorProfileClinicPicker({ slug, clinics, selectedId }: Props) {
  if (clinics.length <= 1) return null;

  const t = await getTranslations("BookingPage");
  const locale = await getLocale();

  return (
    <div
      className="mb-4 rounded-3xl border border-profile-border bg-profile-surface p-4 text-profile-body sm:p-5"
      data-testid="profile-clinic-picker"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-link">
        {t("chooseClinicStep")}
      </p>
      <h2 className="mt-1 text-lg font-extrabold text-profile-text">
        {t("chooseClinicHeading")}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-profile-muted">
        {t("chooseClinicBody", { count: clinics.length })}
      </p>
      <div
        className={`mt-4 grid gap-3 ${clinics.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}
        role="list"
      >
        {clinics.map((clinic, index) => {
          const selected = clinic.id === selectedId;
          const address = clinicAddressFirstLine(clinic.clinic_address);
          const place =
            String(clinic.town ?? "").trim() ||
            String(clinic.district ?? "").trim();
          const href = `/${locale}/${slug}?location=${encodeURIComponent(clinic.id)}`;
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    selected ? "bg-accent text-accent-on" : "bg-profile-bg text-profile-text"
                  }`}
                >
                  {index + 1}
                </span>
                {selected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-profile-surface px-2 py-0.5 text-[11px] font-bold text-profile-text">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    {t("bookingHere")}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-base font-extrabold text-profile-text">
                {clinicTitleOrFallback(
                  clinic.label,
                  t("clinicNumber", { number: index + 1 }),
                )}
              </p>
              {place ? (
                <p className="mt-0.5 text-sm font-medium text-profile-body">{place}</p>
              ) : null}
              {address ? (
                <p className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-profile-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-link" aria-hidden />
                  <span>{address}</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-profile-muted">{t("clinicAddressMissing")}</p>
              )}
              {clinic.pause_online_bookings ? (
                <p className="mt-3 text-xs font-bold text-profile-muted">
                  {t("onlineBookingOff")}
                </p>
              ) : selected ? null : (
                <p className="mt-3 text-sm font-bold text-accent-link">
                  {t("tapToBookHere")}
                </p>
              )}
            </>
          );

          if (selected) {
            return (
              <div
                key={clinic.id}
                role="listitem"
                className="h-full rounded-2xl border-2 border-accent bg-accent-soft p-4"
                aria-current="true"
              >
                {body}
              </div>
            );
          }

          return (
            <div key={clinic.id} role="listitem" className="h-full">
              <PendingLink
                href={href}
                scroll={false}
                fill
                className="h-full w-full rounded-2xl border-2 border-profile-border bg-profile-surface p-4 text-left transition hover:border-accent"
              >
                <span className="block w-full text-left">
                  {body}
                </span>
              </PendingLink>
            </div>
          );
        })}
      </div>
    </div>
  );
}
