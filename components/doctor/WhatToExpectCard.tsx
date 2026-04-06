import { CalendarCheck2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Standalone callout so "What to expect" is visible on mobile without opening the About accordion.
 */
const steps = [
  { lead: "whatToExpectStep1Lead", body: "whatToExpectStep1Body" },
  { lead: "whatToExpectStep2Lead", body: "whatToExpectStep2Body" },
  { lead: "whatToExpectStep3Lead", body: "whatToExpectStep3Body" },
] as const;

export async function WhatToExpectCard() {
  const t = await getTranslations("DoctorProfilePage");
  return (
    <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4 shadow-lg shadow-slate-950/20 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-emerald-200">
        <CalendarCheck2 className="h-4 w-4 text-emerald-300" aria-hidden />
        <p
          id="what-to-expect-heading"
          className="text-xs font-semibold tracking-[0.2em] text-emerald-200/90"
        >
          {t("whatToExpectTitle")}
        </p>
      </div>
      <ol
        className="mt-3 list-none space-y-3.5 text-sm leading-relaxed text-slate-200/90"
        aria-labelledby="what-to-expect-heading"
      >
        {steps.map(({ lead, body }, index) => (
          <li key={lead} className="flex gap-2.5">
            <span
              className="w-5 shrink-0 pt-0.5 text-right font-semibold tabular-nums text-emerald-200/90"
              aria-hidden
            >
              {index + 1}.
            </span>
            <span>
              <span className="font-semibold text-slate-100">{t(lead)}</span>{" "}
              {t(body)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
