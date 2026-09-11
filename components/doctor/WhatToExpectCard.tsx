import { getTranslations } from "next-intl/server";

/**
 * Standalone callout so "What to expect" is visible on mobile without opening the About accordion.
 * Inline SVG (not lucide) — avoids intermittent RSC webpack corruption with optimizePackageImports.
 */
const steps = [
  { lead: "whatToExpectStep1Lead", body: "whatToExpectStep1Body" },
  { lead: "whatToExpectStep2Lead", body: "whatToExpectStep2Body" },
  { lead: "whatToExpectStep3Lead", body: "whatToExpectStep3Body" },
] as const;

function CalendarCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

export async function WhatToExpectCard() {
  const t = await getTranslations("DoctorProfilePage");
  return (
    <div className="rounded-3xl border border-clinical-200 bg-clinical-50 p-4 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_4px_16px_rgba(18,184,192,0.05)]">
      <div className="flex items-center gap-2 text-clinical-700">
        <CalendarCheckIcon className="h-4 w-4 text-clinical-600" />
        <p
          id="what-to-expect-heading"
          className="text-xs font-semibold tracking-[0.2em] text-clinical-700"
        >
          {t("whatToExpectTitle")}
        </p>
      </div>
      <ol
        className="mt-3 list-none space-y-3.5 text-sm leading-relaxed text-ink-700"
        aria-labelledby="what-to-expect-heading"
      >
        {steps.map(({ lead, body }, index) => (
          <li key={lead} className="flex gap-2.5">
            <span
              className="w-5 shrink-0 pt-0.5 text-right font-semibold tabular-nums text-clinical-600"
              aria-hidden
            >
              {index + 1}.
            </span>
            <span>
              <span className="font-semibold text-ink-900">{t(lead)}</span>{" "}
              {t(body)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
