import { Check, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PendingLink } from "@/components/navigation/PendingLink";
import {
  clinicAddressFirstLine,
  clinicTitleOrFallback,
  profileClinicAccent,
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
      className="mb-4 rounded-3xl border border-clinical-200 bg-white p-4 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] sm:p-5"
      data-testid="profile-clinic-picker"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clinical-700">
        {t("chooseClinicStep")}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-ink-900">
        {t("chooseClinicHeading")}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-600">
        {t("chooseClinicBody", { count: clinics.length })}
      </p>
      <div
        className={`mt-4 grid gap-3 ${clinics.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}
        role="list"
      >
        {clinics.map((clinic, index) => {
          const selected = clinic.id === selectedId;
          const accent = profileClinicAccent(index);
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
                    selected ? accent.number : accent.numberIdle
                  }`}
                >
                  {index + 1}
                </span>
                {selected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-ink-800">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    {t("bookingHere")}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-base font-semibold text-ink-900">
                {clinicTitleOrFallback(
                  clinic.label,
                  t("clinicNumber", { number: index + 1 }),
                )}
              </p>
              {place ? (
                <p className="mt-0.5 text-sm font-medium text-ink-700">{place}</p>
              ) : null}
              {address ? (
                <p className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-ink-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-clinical-600" aria-hidden />
                  <span>{address}</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-500">{t("clinicAddressMissing")}</p>
              )}
              {clinic.pause_online_bookings ? (
                <p className="mt-3 text-xs font-semibold text-amber-800">
                  {t("onlineBookingOff")}
                </p>
              ) : selected ? null : (
                <p className={`mt-3 text-sm font-semibold ${accent.cta}`}>
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
                className={`h-full rounded-2xl border-2 p-4 ${accent.selected}`}
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
                className={`h-full w-full rounded-2xl border-2 p-4 text-left transition ${accent.idle}`}
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
