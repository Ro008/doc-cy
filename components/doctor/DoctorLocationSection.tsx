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
      <div className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 p-5 shadow-2xl shadow-slate-950/50 backdrop-blur-xl sm:p-6">
        <h2 className="text-sm font-semibold tracking-wide text-slate-100">
          Location
        </h2>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-start gap-2 text-sm text-slate-200 transition hover:text-emerald-300"
        >
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80" />
          <span>{clinicAddress}</span>
        </a>
      </div>
    </section>
  );
}
