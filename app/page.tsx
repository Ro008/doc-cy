// app/page.tsx
import {
  BellRing,
  CalendarSync,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Globe,
  Moon,
  PhoneCall,
  PhoneMissed,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FoundersPricingCard } from "@/components/landing/FoundersPricingCard";
import { HomeLandingScroll } from "@/components/landing/HomeLandingScroll";
import { getTranslations, getLocale } from "next-intl/server";
import { ProductShowcaseCarousel } from "@/components/landing/ProductShowcaseCarousel";
import { PendingLink } from "@/components/navigation/PendingLink";
import { ProfessionalAccessButton } from "@/components/landing/ProfessionalAccessButton";
import { MarketingFooter } from "@/components/navigation/MarketingFooter";
import { SupportInquiryLink } from "@/components/landing/SupportInquiryLink";

type Benefit = {
  icon: LucideIcon;
  title: string;
  body: string;
  iconWell: string;
};

/** Premium cards on clinical light UI */
const benefitCardShell =
  "rounded-2xl border border-clinical-200 bg-white p-4 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_4px_16px_rgba(11,123,181,0.05)] transition hover:border-clinical-300 hover:shadow-[0_4px_20px_rgba(11,123,181,0.1)] sm:p-5";

const landingCtaClass =
  "inline-flex items-center justify-center rounded-xl bg-clinical-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(11,123,181,0.2),0_4px_14px_rgba(11,123,181,0.22)] transition hover:bg-clinical-400 hover:shadow-[0_4px_18px_rgba(11,123,181,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50";

const landingSectionShell =
  "rounded-3xl border border-clinical-200 bg-white p-5 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(11,123,181,0.06)] sm:p-7";

export default async function HomePage() {
  const t = await getTranslations("LandingPage");
  const locale = await getLocale();
  const isGreek = locale === "el";

  const adoptionPlaybookSteps: Benefit[] = [
    {
      icon: Moon,
      title: t("AdoptionPlaybook.steps.weekendShield.title"),
      body: t("AdoptionPlaybook.steps.weekendShield.body"),
      iconWell:
        "bg-indigo-400/25 text-indigo-200 shadow-[0_0_24px_-4px_rgba(129,140,248,0.55)] ring-2 ring-indigo-300/50",
    },
    {
      icon: PhoneCall,
      title: t("AdoptionPlaybook.steps.liveHandoff.title"),
      body: t("AdoptionPlaybook.steps.liveHandoff.body"),
      iconWell:
        "bg-amber-400/25 text-amber-200 shadow-[0_0_24px_-4px_rgba(251,191,36,0.5)] ring-2 ring-amber-300/55",
    },
    {
      icon: Globe,
      title: t("AdoptionPlaybook.steps.websiteButton.title"),
      body: t("AdoptionPlaybook.steps.websiteButton.body"),
      iconWell:
        "bg-violet-400/25 text-violet-200 shadow-[0_0_24px_-4px_rgba(167,139,250,0.5)] ring-2 ring-violet-300/55",
    },
  ];

  const adoptionPlaybookResults = [
    t("AdoptionPlaybook.steps.weekendShield.result"),
    t("AdoptionPlaybook.steps.liveHandoff.result"),
    t("AdoptionPlaybook.steps.websiteButton.result"),
  ];

  const manualBookingPains: Benefit[] = [
    {
      icon: BellRing,
      title: t("Features.painDistractionLabel"),
      body: t("Features.painDistractionBody"),
      iconWell:
        "bg-rose-400/20 text-rose-200 shadow-[0_0_20px_-6px_rgba(251,113,133,0.45)] ring-2 ring-rose-300/40",
    },
    {
      icon: ClipboardList,
      title: t("Features.painAdminDebtLabel"),
      body: t("Features.painAdminDebtBody"),
      iconWell:
        "bg-amber-400/20 text-amber-200 shadow-[0_0_20px_-6px_rgba(251,191,36,0.45)] ring-2 ring-amber-300/40",
    },
    {
      icon: PhoneMissed,
      title: t("Features.painSilentLeaksLabel"),
      body: t("Features.painSilentLeaksBody"),
      iconWell:
        "bg-slate-400/20 text-slate-200 shadow-[0_0_20px_-6px_rgba(148,163,184,0.4)] ring-2 ring-slate-300/35",
    },
  ];

  const showcaseSlides = [
    {
      title: t("Showcase.slides.smartRequestFilter.title"),
      body: t("Showcase.slides.smartRequestFilter.body"),
      imageSrc: "/showcase/13-smart-request-email.png",
      categoryLabel: t("Showcase.badges.forYou"),
      device: "desktop" as const,
      desktopWideCapture: true,
    },
    {
      title: t("Showcase.slides.breakGuard.title"),
      body: t("Showcase.slides.breakGuard.body"),
      imageSrc: "/showcase/12-break-protection.png",
      categoryLabel: t("Showcase.badges.forYou"),
      device: "desktop" as const,
      desktopWideCapture: true,
    },
    {
      title: t("Showcase.slides.overlapGuard.title"),
      body: t("Showcase.slides.overlapGuard.body"),
      imageSrc: "/showcase/10-overlap-rescue.png",
      categoryLabel: t("Showcase.badges.forYou"),
      device: "desktop" as const,
      desktopWideCapture: true,
    },
    {
      title: t("Showcase.slides.proposalEmail.title"),
      body: t("Showcase.slides.proposalEmail.body"),
      imageSrc: "/showcase/11-proposal-email.png",
      categoryLabel: t("Showcase.badges.forPatients"),
      device: "desktop" as const,
      desktopWideCapture: true,
    },
    {
      title: t("Showcase.slides.pendingClarity.title"),
      body: t("Showcase.slides.pendingClarity.body"),
      imageSrc: "/showcase/15-patient-pending-status.png",
      categoryLabel: t("Showcase.badges.forPatients"),
      device: "desktop" as const,
      desktopWideCapture: true,
    },
    {
      title: t("Showcase.slides.pendingVisual.title"),
      body: t("Showcase.slides.pendingVisual.body"),
      imageSrc: "/showcase/14-pending-slot-visual.png",
      categoryLabel: t("Showcase.badges.forYou"),
      device: "desktop" as const,
      desktopWideCapture: true,
    },
    {
      title: t("Showcase.slides.automatedFollowup.title"),
      body: t("Showcase.slides.automatedFollowup.body"),
      imageSrc: "/showcase/01-update-on-request.png",
      categoryLabel: t("Showcase.badges.forPatients"),
      device: "desktop" as const,
      desktopWideCapture: true,
    },
    {
      title: t("Showcase.slides.sync.title"),
      body: t("Showcase.slides.sync.body"),
      imageSrc: "/showcase/04-google-calendar.png",
      categoryLabel: t("Showcase.badges.forPatients"),
      device: "phone" as const,
    },
    {
      title: t("Showcase.slides.weeklyGrid.title"),
      body: t("Showcase.slides.weeklyGrid.body"),
      imageSrc: "/showcase/06-weekly-grid.png",
      categoryLabel: t("Showcase.badges.forYou"),
      device: "desktop" as const,
      mobileDesktopFrameClass: "aspect-[4/3] sm:h-auto sm:aspect-[16/10]",
      mobileDesktopImageClass: "object-contain",
    },
    {
      title: t("Showcase.slides.premiumStorefront.title"),
      body: t("Showcase.slides.premiumStorefront.body"),
      imageSrc: "/showcase/16-premium-storefront.png",
      categoryLabel: t("Showcase.badges.forPatients"),
      device: "desktop" as const,
      desktopWideCapture: true,
    },
    {
      title: t("Showcase.slides.settingsSchedule.title"),
      body: t("Showcase.slides.settingsSchedule.body"),
      imageSrc: "/showcase/09-settings-schedule.png",
      categoryLabel: t("Showcase.badges.forYou"),
      device: "desktop" as const,
      mobileDesktopFrameClass: "aspect-[4/3] sm:h-auto sm:aspect-[16/10]",
      mobileDesktopImageClass: "object-contain",
    },
    {
      title: t("Showcase.slides.settingsProfile.title"),
      body: t("Showcase.slides.settingsProfile.body"),
      imageSrc: "/showcase/08-settings-profile.png",
      categoryLabel: t("Showcase.badges.forYou"),
      device: "desktop" as const,
      mobileDesktopFrameClass: "aspect-[4/3] sm:h-auto sm:aspect-[16/10]",
      mobileDesktopImageClass: "object-contain",
    },
  ];
  const faqItems = [
    {
      question: t("FAQ.items.doubleBookings.question"),
      answers: [t("FAQ.items.doubleBookings.answer1"), t("FAQ.items.doubleBookings.answer2")],
    },
    {
      question: t("FAQ.items.frontDeskWorkload.question"),
      answers: [
        t("FAQ.items.frontDeskWorkload.answer1"),
        t("FAQ.items.frontDeskWorkload.answer2"),
        t("FAQ.items.frontDeskWorkload.answer3"),
      ],
    },
    {
      question: t("FAQ.items.patientHabit.question"),
      answers: [t("FAQ.items.patientHabit.answer1"), t("FAQ.items.patientHabit.answer2")],
    },
    {
      question: t("FAQ.items.privateWebsiteVsDoccy.question"),
      answers: [
        t("FAQ.items.privateWebsiteVsDoccy.answer1"),
        t("FAQ.items.privateWebsiteVsDoccy.answer2"),
        t("FAQ.items.privateWebsiteVsDoccy.answer3"),
      ],
    },
    {
      question: t("FAQ.items.teamAccess.question"),
      answers: [t("FAQ.items.teamAccess.answer1"), t("FAQ.items.teamAccess.answer2")],
    },
    {
      question: t("FAQ.items.setupTime.question"),
      answers: [
        t("FAQ.items.setupTime.answer1"),
        t("FAQ.items.setupTime.answer2"),
        t("FAQ.items.setupTime.answer3"),
      ],
      contactCta: t("FAQ.items.setupTime.contactCta"),
    },
    {
      question: t("FAQ.items.directoriesZeroResults.question"),
      answers: [
        t("FAQ.items.directoriesZeroResults.answer1"),
        t("FAQ.items.directoriesZeroResults.answer2"),
        t("FAQ.items.directoriesZeroResults.answer3"),
      ],
    },
  ];

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-ink-50 text-ink-800 [overflow-anchor:none]">
      <HomeLandingScroll />
      {/*
        Ambient layers must stay inside this stacking context (isolate + z-0 / z-10).
        Fixed + negative z-index was painting under the body / wrong layer, so only the gray radial read.
      */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <div className="landing-ambient-radial" />
        <div className="landing-ambient-aurora-tl" />
        <div className="landing-ambient-aurora-br" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <header className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="text-base font-semibold tracking-tight text-ink-800 sm:text-lg">
              Doc<span className="text-clinical-500">Cy</span>
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col justify-center py-8 lg:py-12">
          <section className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)] lg:gap-12">
            <div className="min-w-0">
              <h1
                className={`max-w-3xl text-balance font-semibold tracking-tight text-ink-900 ${
                  isGreek
                    ? "text-4xl leading-[1.14] sm:text-[2.35rem] sm:leading-[1.12] lg:text-[2.85rem] lg:leading-[1.08] xl:text-[3.05rem]"
                    : "text-4xl sm:text-5xl sm:leading-[1.08] lg:text-[3.2rem] lg:leading-[1.04] xl:text-[3.5rem]"
                }`}
              >
                {t("Hero.title")}
              </h1>

              <p className="mt-8 flex max-w-2xl flex-col gap-3 text-base leading-8 text-ink-600 sm:text-lg sm:leading-9">
                <span>{t("Hero.subtitleLine1")}</span>
                {t("Hero.subtitleLine2") ? <span>{t("Hero.subtitleLine2")}</span> : null}
              </p>
              <p className="mt-7 whitespace-pre-line text-lg font-medium leading-relaxed text-wellness-700 sm:text-xl">
                {t("Hero.kicker")}
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <PendingLink href="#founders-pricing-card" className={landingCtaClass}>
                  {t("Hero.ctaClaim")}
                </PendingLink>

                <ProfessionalAccessButton />
              </div>

            </div>

            <aside className="relative hidden min-h-[390px] lg:block" aria-hidden>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-72 w-72 rounded-full border border-clinical-200 bg-clinical-50 shadow-[0_0_60px_-20px_rgba(11,123,181,0.25)]" />
                <div className="absolute h-56 w-56 rounded-full border border-clinical-200/80" />
                <div className="absolute h-40 w-40 rounded-full border border-wellness-200 bg-wellness-50" />
              </div>

              <div className="absolute left-0 top-10 w-56 rounded-2xl border border-ink-200 bg-white p-3 shadow-md transition duration-300 hover:-translate-y-0.5 hover:border-clinical-300">
                <div className="flex items-center gap-2">
                  <CalendarSync className="h-4 w-4 text-clinical-500" aria-hidden />
                  <p className="text-xs font-semibold text-ink-800">{t("Hero.visualIncoming")}</p>
                </div>
              </div>

              <div className="absolute right-2 top-36 w-60 rounded-2xl border border-ink-200 bg-white p-3 shadow-md transition duration-300 hover:-translate-y-0.5 hover:border-wellness-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-wellness-500" aria-hidden />
                  <p className="text-xs font-semibold text-ink-800">
                    {t("Hero.visualNoInterruptions")}
                  </p>
                </div>
              </div>

              <div className="absolute bottom-12 left-12 w-56 rounded-2xl border border-wellness-300 bg-wellness-50 p-3 shadow-md transition duration-300 hover:-translate-y-0.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-wellness-600" aria-hidden />
                  <p className="text-xs font-semibold text-wellness-800">{t("Hero.visualConfirmed")}</p>
                </div>
              </div>
            </aside>
          </section>
        </div>

        <section id="why-doccy" className="mx-auto w-full max-w-6xl pb-8 pt-2 sm:pb-10 [overflow-anchor:none]">
          <div className={landingSectionShell}>
            <p className="text-xs font-semibold tracking-[0.18em] text-clinical-600">
              {t("Features.eyebrow")}
            </p>
            <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {t("Features.title")}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-500 sm:text-base">
              {t("Features.intro")}
            </p>

            <p className="mt-6 text-sm font-semibold text-ink-700 sm:text-base">
              {t("Features.painHeading")}
            </p>
            <ul className="mt-3 space-y-3">
              {manualBookingPains.map(({ icon: Icon, title, body, iconWell }) => (
                <li
                  key={title}
                  className="flex gap-3 rounded-xl border border-ink-200 bg-ink-50 px-3 py-3 sm:gap-4 sm:px-4"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 ${iconWell}`}
                  >
                    <Icon className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} aria-hidden />
                  </div>
                  <p className="min-w-0 pt-0.5 text-sm leading-relaxed text-ink-600 sm:text-base">
                    <span className="font-semibold text-ink-800">{title}:</span> {body}
                  </p>
                </li>
              ))}
            </ul>

            <p className="mt-6 rounded-2xl border border-clinical-200 bg-clinical-50 px-4 py-3 text-sm font-medium leading-relaxed text-clinical-800 sm:text-base">
              {t("Features.closing")}
            </p>
          </div>
        </section>

        <section
          id="adoption-playbook"
          className="mx-auto w-full max-w-6xl pb-8 pt-2 sm:pb-10 [overflow-anchor:none]"
        >
          <div className={landingSectionShell}>
            <p className="text-xs font-semibold tracking-[0.18em] text-clinical-600">
              {t("AdoptionPlaybook.eyebrow")}
            </p>
            <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {t("AdoptionPlaybook.title")}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-500 sm:text-base">
              {t("AdoptionPlaybook.lead")}
            </p>

            <ul className="mt-6 grid gap-4 lg:grid-cols-3">
              {adoptionPlaybookSteps.map(({ icon: Icon, title, body, iconWell }, idx) => (
                <li key={title} className={benefitCardShell}>
                  <div className="flex gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14 ${iconWell}`}
                    >
                      <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-clinical-600">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <p className="text-base font-bold leading-snug tracking-tight text-ink-900">
                        {title}
                      </p>
                      <p className="mt-1 text-sm font-normal leading-snug text-ink-500">{body}</p>
                      <p className="mt-2 text-xs font-medium leading-relaxed text-wellness-700">
                        {adoptionPlaybookResults[idx]}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-5 max-w-3xl rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-600">
              {t("AdoptionPlaybook.closing")}
            </p>
            <div className="mt-4 flex justify-center sm:justify-start">
              <a
                href="#founders-pricing-card"
                className="inline-flex items-center gap-1.5 rounded-full border border-clinical-300 bg-clinical-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-clinical-700 transition hover:bg-clinical-100 hover:text-clinical-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400"
              >
                {t("AdoptionPlaybook.cta")}
                <ChevronDown className="h-3.5 w-3.5 motion-safe:animate-bounce" aria-hidden />
              </a>
            </div>
          </div>
        </section>

        <section
          id="showcase-section"
          className="mx-auto w-full max-w-6xl pb-8 pt-4 sm:pb-10 [overflow-anchor:none]"
        >
          <div className={`${landingSectionShell} shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_28px_rgba(11,123,181,0.08)]`}>
            <div className="mb-4 sm:mb-5">
              <h2 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                {t("Showcase.title")}
              </h2>
            </div>
            <ProductShowcaseCarousel slides={showcaseSlides} />
          </div>
        </section>
        <section
          id="founders-pricing"
          className="mx-auto w-full max-w-6xl pb-10 pt-4 sm:pb-10 [overflow-anchor:none]"
        >
          <div className="group mb-6 rounded-3xl border border-rose-200 bg-gradient-to-br from-white via-rose-50/40 to-rose-100/50 p-5 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(225,29,72,0.08)] transition sm:mb-8 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
              {t("Visibility.eyebrow")}
            </p>

            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {t("Visibility.title")}
            </h2>
            <p className="mt-1 text-sm italic leading-relaxed text-rose-700 sm:text-base">
              {t("Visibility.subtitle")}
            </p>

            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-ink-600 sm:text-base">
              {t("Visibility.intro")}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-rose-300">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-800">
                  {t("Visibility.beforeTitle")}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  <li className="flex items-start gap-2 text-sm text-rose-900/90">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                    <span>{t("Visibility.beforePoints.cost")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-rose-900/90">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                    <span>{t("Visibility.beforePoints.tech")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-rose-900/90">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                    <span>{t("Visibility.beforePoints.visibility")}</span>
                  </li>
                </ul>
              </article>

              <article className="rounded-2xl border border-wellness-300 bg-wellness-50 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-wellness-400">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-wellness-800">
                  {t("Visibility.afterTitle")}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  <li className="flex items-start gap-2 text-sm text-wellness-900/90">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-wellness-600" aria-hidden />
                    <span>{t("Visibility.afterPoints.speed")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-wellness-900/90">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-wellness-600" aria-hidden />
                    <span>{t("Visibility.afterPoints.maintenance")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-wellness-900/90">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-wellness-600" aria-hidden />
                    <span>{t("Visibility.afterPoints.authority")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-wellness-900/90">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-wellness-600" aria-hidden />
                    <span>{t("Visibility.afterPoints.patientTools")}</span>
                  </li>
                </ul>
              </article>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <p className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-ink-600 transition hover:-translate-y-0.5 hover:border-rose-200">
                {t("Visibility.comparison.websiteCost")}
              </p>
              <p className="rounded-xl border border-clinical-200 bg-clinical-50 px-3 py-2 text-xs font-semibold leading-relaxed text-clinical-800 transition hover:-translate-y-0.5 hover:bg-clinical-100">
                {t("Visibility.comparison.doccyCost")}
              </p>
            </div>

            <p className="mt-5 max-w-4xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800 sm:text-base">
              {t("Visibility.closing")}
            </p>

            <article
              className="mx-auto mt-8 max-w-2xl rounded-2xl border border-ink-200 bg-ink-50 px-5 py-6 sm:px-6 sm:py-7"
              aria-labelledby="skepticism-killer-heading"
            >
              <h3
                id="skepticism-killer-heading"
                className="text-center text-lg font-semibold tracking-tight text-ink-900 sm:text-xl"
              >
                {t("SkepticismKiller.title")}
              </h3>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-600 sm:text-base">
                <p>{t("SkepticismKiller.p1")}</p>
                <p className="text-ink-800">{t("SkepticismKiller.p2")}</p>
                <p>{t("SkepticismKiller.p3")}</p>
              </div>
            </article>

            <div className="mt-4 flex justify-center">
              <a
                href="#founders-pricing-card"
                className="inline-flex items-center gap-1.5 rounded-full border border-clinical-300 bg-clinical-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-clinical-700 transition hover:bg-clinical-100 hover:text-clinical-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400"
              >
                {t("Visibility.scrollCue")}
                <ChevronDown className="h-3.5 w-3.5 motion-safe:animate-bounce" aria-hidden />
              </a>
            </div>
          </div>

          <div
            id="founders-pricing-card"
            className="mx-auto max-w-lg rounded-3xl border border-clinical-200 bg-white p-5 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_28px_rgba(11,123,181,0.08)] sm:p-6"
          >
            <header>
              <p className="text-center text-xs font-semibold tracking-[0.18em] text-clinical-600">
                {t("Pricing.badge")}
              </p>
              <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight text-ink-900 sm:text-[1.65rem]">
                {t("Pricing.title")}
              </h2>
              <p className="mt-2 text-center text-sm leading-relaxed text-ink-500">
                {t("Pricing.subtitle")}
              </p>
            </header>

            <FoundersPricingCard embedded />
          </div>
        </section>
        <section className="mx-auto w-full max-w-6xl pb-10 pt-2 sm:pb-12 [overflow-anchor:none]">
          <div className={landingSectionShell}>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {t("FAQ.heading")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-500 sm:text-base">
              {t("FAQ.intro")}
            </p>

            <div className="mt-5 space-y-3">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-ink-200 bg-ink-50 p-4 transition hover:border-clinical-300"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-left">
                    <span className="text-sm font-semibold leading-snug text-ink-800 sm:text-base">
                      {item.question}
                    </span>
                    <ChevronDown
                      className="mt-0.5 h-4 w-4 shrink-0 text-clinical-500 transition group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="mt-3 space-y-2">
                    {item.answers.map((answer) => (
                      <p key={answer} className="text-sm leading-relaxed text-ink-600">
                        {answer}
                      </p>
                    ))}
                    {"contactCta" in item ? (
                      <div className="pt-1">
                        <SupportInquiryLink label={item.contactCta} />
                      </div>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>
      <MarketingFooter variant="light" />
    </main>
  );
}
