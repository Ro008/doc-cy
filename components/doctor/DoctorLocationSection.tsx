"use client";

import { MapPin } from "lucide-react";

type DoctorLocationSectionProps = {
  clinicAddress: string;
  mapsUrl: string;
};

export function DoctorLocationSection({
  clinicAddress,
  mapsUrl,
}: DoctorLocationSectionProps) {
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
      </div>
    </section>
  );
}
