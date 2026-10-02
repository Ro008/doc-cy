import { getTranslations } from "next-intl/server";

/** The three steps of a booking request, next to the calendar. */
const steps = [
  { lead: "whatToExpectStep1Lead", body: "whatToExpectStep1Body" },
  { lead: "whatToExpectStep2Lead", body: "whatToExpectStep2Body" },
  { lead: "whatToExpectStep3Lead", body: "whatToExpectStep3Body" },
] as const;

export async function WhatToExpectCard() {
  const t = await getTranslations("DoctorProfilePage");
  return (
    <div className="rounded-3xl bg-accent-soft p-5 text-profile-text sm:p-6">
      <p
        id="what-to-expect-heading"
        className="text-xs font-extrabold uppercase tracking-[0.16em]"
      >
        {t("whatToExpectTitle")}
      </p>
      <ol
        className="mt-4 flex list-none flex-col gap-4 text-sm leading-relaxed"
        aria-labelledby="what-to-expect-heading"
      >
        {steps.map(({ lead, body }, index) => (
          <li key={lead} className="flex gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-on"
              aria-hidden
            >
              {index + 1}
            </span>
            <span>
              <span className="font-bold">{t(lead)}</span> {t(body)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
