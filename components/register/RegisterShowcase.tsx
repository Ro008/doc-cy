"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CalendarPlus, Check, Mail, Search } from "lucide-react";

const AUTOPLAY_MS = 6_000;

const mockCard =
  "rounded-[18px] bg-white shadow-[0_14px_36px_rgba(6,47,97,0.22)] sm:rounded-[20px] sm:shadow-[0_18px_50px_rgba(6,47,97,0.22)]";

type Slide = {
  kicker: string;
  title: string;
  body: string;
  mock: React.ReactNode;
};

const SLIDES: readonly Slide[] = [
  {
    kicker: "1-CLICK APPROVALS",
    title: "Patients request. You approve in one click.",
    body: "Every request comes with name, time and reason. Nothing enters your agenda without you.",
    mock: (
      <div className={`${mockCard} flex flex-col gap-3 p-4 sm:gap-4 sm:px-6 sm:py-[22px]`}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.12em] text-clinical-800 sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-clinical-500" aria-hidden />
            NEW REQUEST
          </span>
          <span className="hidden text-xs text-ink-600 sm:inline">2 min ago</span>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wellness-200 text-sm font-extrabold text-wellness-900 sm:h-[46px] sm:w-[46px]">
            EK
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-[15px] font-bold text-ink-900 sm:text-base">Elena K. · New patient</span>
            <span className="text-[13px] text-ink-600 sm:text-sm">Thu 14 Nov · 10:30 · Lower back pain</span>
          </div>
        </div>
        <div className="flex gap-2.5">
          <span className="hidden h-11 flex-1 items-center justify-center rounded-[10px] border-[1.5px] border-ink-200 text-sm font-semibold text-ink-700 sm:flex">
            Suggest another time
          </span>
          <span className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-clinical-500 text-sm font-extrabold text-ink-900">
            <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />
            Approve
          </span>
        </div>
      </div>
    ),
  },
  {
    kicker: "YOUR DIGITAL STOREFRONT",
    title: "Your profile is your new website.",
    body: "Live in minutes and built for local Google searches, for Cyprus's mix of local and expat patients.",
    mock: (
      <div className={`${mockCard} flex gap-3.5 p-4 sm:gap-[18px] sm:px-6 sm:py-[22px]`}>
        <span className="h-16 w-16 shrink-0 rounded-[14px] bg-clinical-300 sm:h-[88px] sm:w-[88px] sm:rounded-[18px]" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
          <span className="text-base font-extrabold text-ink-900 sm:text-lg">Maria Georgiou</span>
          <span className="text-[13px] text-ink-600 sm:text-sm">Physiotherapist · Limassol</span>
          <div className="flex gap-1.5">
            <span className="rounded-full bg-clinical-100 px-2.5 py-1 text-[11px] font-bold text-clinical-900 sm:text-xs">English</span>
            <span className="rounded-full bg-wellness-50 px-2.5 py-1 text-[11px] font-bold text-wellness-800 sm:text-xs">Greek</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-wellness-700 sm:text-[13px]">Next available: tomorrow 09:00</span>
            <span className="hidden h-[38px] items-center rounded-[10px] bg-clinical-500 px-3.5 text-[13px] font-extrabold text-ink-900 sm:flex">
              Request
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    kicker: "ADD TO CALENDAR",
    title: "Every confirmed visit, one click from your calendar.",
    body: "When a booking is confirmed, you and your patient each get an email with buttons to add it to Google Calendar or Apple / Outlook.",
    mock: (
      <div className={`${mockCard} flex flex-col gap-2.5 p-4 sm:gap-3.5 sm:px-6 sm:py-[22px]`}>
        <div className="flex items-center gap-3 border-b border-ink-100 pb-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-clinical-100 text-clinical-800">
            <Mail className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="text-xs text-ink-600 sm:text-[13px]">DocCy · to you and Elena K.</span>
            <span className="text-[15px] font-extrabold text-ink-900">Appointment confirmed</span>
          </div>
        </div>
        <span className="text-[13px] text-ink-700 sm:text-sm">
          Thu 14 Nov · 10:30 · Maria Georgiou, Physiotherapist
        </span>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2.5">
          <span className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-clinical-500 text-[13px] font-extrabold text-ink-900 sm:h-11 sm:text-sm">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Add to Google Calendar
          </span>
          <span className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-clinical-500 text-[13px] font-extrabold text-clinical-800 sm:h-11 sm:text-sm">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Apple / Outlook
          </span>
        </div>
      </div>
    ),
  },
  {
    kicker: "THE WEEKEND SHIELD",
    title: "Found by new patients, even on Saturday.",
    body: "Patients filter by specialty, town and language, then request a slot while your clinic is closed. Founding Members get priority placement.",
    mock: (
      <div className={`${mockCard} flex flex-col gap-2.5 p-3.5 sm:p-[18px]`}>
        <div className="flex h-[42px] items-center gap-2.5 rounded-[10px] border-[1.5px] border-ink-200 px-3 text-[13px] text-ink-700 sm:h-11 sm:text-sm">
          <Search className="h-4 w-4 text-clinical-800" aria-hidden />
          Physiotherapist · Limassol · Greek
        </div>
        <div className="flex items-center gap-3 rounded-xl border-[1.5px] border-clinical-500 bg-clinical-100 p-2.5 sm:p-3">
          <span className="h-9 w-9 rounded-[10px] bg-clinical-300 sm:h-10 sm:w-10" aria-hidden />
          <span className="flex-1 text-sm font-extrabold text-ink-900">Maria Georgiou</span>
          <span className="rounded-full bg-ink-900 px-2 py-1 text-[10px] font-extrabold tracking-[0.08em] text-white sm:px-2.5 sm:text-[11px]">
            PRIORITY
          </span>
        </div>
        <div className="hidden items-center gap-3 rounded-xl border border-ink-100 p-3 sm:flex">
          <span className="h-10 w-10 rounded-[10px] bg-ink-100" aria-hidden />
          <span className="flex-1 text-sm text-ink-600">Another professional</span>
        </div>
      </div>
    ),
  },
];

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Rotating "why DocCy" slides with product mock-ups, shown beside (desktop) or under (phones) the form. */
export function RegisterShowcase() {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const count = SLIDES.length;

  React.useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  const go = (next: number) => setIndex(((next % count) + count) % count);

  return (
    <div
      data-testid="register-showcase"
      role="region"
      aria-roledescription="carousel"
      aria-label="Why professionals join DocCy"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative flex min-h-0 flex-1 flex-col gap-5 lg:gap-6"
    >
      <p className="text-xs font-extrabold tracking-[0.16em] text-ink-900 lg:hidden">
        WHY PROFESSIONALS JOIN
      </p>
      <div className="grid flex-1 content-center">
        {SLIDES.map((slide, slideIndex) => {
          const active = slideIndex === index;
          return (
            <div
              key={slide.kicker}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} of ${count}`}
              aria-hidden={!active}
              className={`col-start-1 row-start-1 flex flex-col gap-4 transition-opacity duration-500 lg:gap-6 ${
                active ? "opacity-100" :"pointer-events-none invisible opacity-0"
              }`}
            >
              <div className="flex flex-col gap-2.5">
                <span className="hidden text-xs font-extrabold tracking-[0.16em] text-ink-900 lg:block">
                  {slide.kicker}
                </span>
                <h2 className="max-w-[520px] text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink-900 lg:text-[34px] lg:leading-[1.12]">
                  {slide.title}
                </h2>
                <p className="max-w-[540px] text-[15px] leading-relaxed text-ink-900 lg:text-base">
                  {slide.body}
                </p>
              </div>
              <div className="max-w-[540px]">{slide.mock}</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 lg:gap-3.5">
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="Previous benefit"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink-900 transition hover:bg-clinical-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
        </button>
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          {SLIDES.map((slide, slideIndex) => (
            <button
              key={slide.kicker}
              type="button"
              onClick={() => go(slideIndex)}
              aria-label={`Show benefit ${slideIndex + 1}`}
              aria-current={slideIndex === index ? "true" : undefined}
              className="flex h-11 items-center"
            >
              <span
                className={`h-1.5 w-full rounded-full transition-colors ${
                  slideIndex === index ? "bg-ink-900" : "bg-white/55"
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="Next benefit"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  );
}
