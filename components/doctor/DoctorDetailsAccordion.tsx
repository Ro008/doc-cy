"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

type DoctorDetailsAccordionProps = {
  name: string;
  bio: string | null;
};

export function DoctorDetailsAccordion({
  name,
  bio,
}: DoctorDetailsAccordionProps) {
  const [open, setOpen] = React.useState(false);
  const bioText = (bio ?? "").trim();
  const truncatedBio =
    bioText.length > 500 ? `${bioText.slice(0, 500).trimEnd()}...` : bioText;
  const firstName = name.trim().split(/\s+/)[0] || name;

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setOpen(true);
    }
  }, []);

  return (
    <section className="lg:min-w-0">
      <div className="rounded-3xl border border-clinical-200 bg-white shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-3xl px-5 py-4 text-left text-sm text-ink-800 outline-none transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50"
          aria-expanded={open}
          aria-controls="doctor-details-panel"
        >
          <span className="font-semibold">
            About {firstName}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-ink-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>

        <div
          id="doctor-details-panel"
          className={`overflow-hidden transition-all duration-300 ${
            open ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-5 pb-5 pt-1">
            <div>
              <p className="text-sm leading-relaxed text-ink-600">
                {truncatedBio || "This professional has not added a bio yet."}
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

