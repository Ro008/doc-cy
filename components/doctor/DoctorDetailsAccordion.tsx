"use client";

import * as React from "react";
import { ChevronDown, MapPin } from "lucide-react";

type DoctorDetailsAccordionProps = {
  name: string;
  specialty: string;
  bio: string | null;
  clinicAddress: string;
  mapsUrl: string;
};

export function DoctorDetailsAccordion({
  name,
  specialty,
  bio,
  clinicAddress,
  mapsUrl,
}: DoctorDetailsAccordionProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setOpen(true);
    }
  }, []);

  return (
    <section className="lg:min-w-0">
      <div className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-3xl px-5 py-4 text-left text-sm text-slate-200 outline-none transition hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          aria-expanded={open}
          aria-controls="doctor-details-panel"
        >
          <span className="font-semibold">
            About Dr. {name.split(" ").slice(-1)[0] || name}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>

        <div
          id="doctor-details-panel"
          className={`overflow-hidden transition-all duration-300 ${
            open ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="space-y-4 px-5 pb-5 pt-1">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-slate-400">
                About
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {bio ?? "This doctor has not added a bio yet."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <p className="text-xs font-semibold tracking-wide text-slate-400">
                  Specialty
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {specialty}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <p className="text-xs font-semibold tracking-wide text-slate-400">
                  Location
                </p>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex items-start gap-2 text-sm text-slate-200 transition hover:text-emerald-300"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80" />
                  <span>{clinicAddress}</span>
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="text-xs font-semibold tracking-[0.2em] text-emerald-200/80">
                What to expect
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Book in seconds. You’ll receive a WhatsApp-friendly contact flow
                and your appointment will appear instantly in the doctor’s
                agenda.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

