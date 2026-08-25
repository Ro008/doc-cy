"use client";

import { Check, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

export type DoctorLocationClinic = {
  title: string;
  address: string;
  mapsUrl: string;
  isBookingHere?: boolean;
};

type DoctorLocationSectionProps = {
  clinicAddress: string;
  mapsUrl: string;
  extraAddresses?: string[];
  clinics?: DoctorLocationClinic[];
};

export function DoctorLocationSection({
  clinicAddress,
  mapsUrl,
  extraAddresses = [],
  clinics = [],
}: DoctorLocationSectionProps) {
  const t = useTranslations("BookingPage");

  if (clinics.length > 1) {
    return (
      <section className="lg:min-w-0">
        <div className="rounded-3xl border border-clinical-200 bg-white p-5 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] backdrop-blur-xl sm:p-6">
          <h2 className="text-sm font-semibold tracking-wide text-ink-900">
            {t("locationClinicsHeading")}
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {t("locationClinicsHint")}
          </p>
          <ul className="mt-3 space-y-3">
            {clinics.map((clinic) => (
              <li key={`${clinic.title}-${clinic.address}`}>
                <a
                  href={clinic.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`block rounded-2xl border p-3 text-sm transition ${
                    clinic.isBookingHere
                      ? "border-clinical-400 bg-clinical-50"
                      : "border-ink-200 bg-white hover:border-clinical-300"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink-900">{clinic.title}</span>
                    {clinic.isBookingHere ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-clinical-800">
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        {t("bookingHere")}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1.5 flex items-start gap-2 text-ink-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-clinical-600" />
                    <span>{clinic.address}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="lg:min-w-0">
      <div className="rounded-3xl border border-clinical-200 bg-white p-5 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] backdrop-blur-xl sm:p-6">
        <h2 className="text-sm font-semibold tracking-wide text-ink-900">
          Location
        </h2>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-start gap-2 text-sm text-ink-700 transition hover:text-clinical-700"
        >
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-clinical-600" />
          <span>{clinicAddress}</span>
        </a>
        {extraAddresses.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {extraAddresses.map((address) => (
              <li key={address} className="flex items-start gap-2 text-sm text-ink-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                <span>{address}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
