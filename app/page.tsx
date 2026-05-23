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

/** Soft mint glow (emerald-300 family) for premium cards on dark UI */
const benefitCardShell =
  "rounded-2xl border border-emerald-300/20 bg-slate-900/75 p-4 shadow-[0_0_36px_-14px_rgba(110,231,183,0.22),0_2px_12px_-4px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:border-emerald-300/35 hover:shadow-[0_0_44px_-12px_rgba(110,231,183,0.32),0_4px_16px_-4px_rgba(0,0,0,0.5)] sm:p-5";

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
    <main className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-slate-950 text-neutral-50 [overflow-anchor:none]">
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
            <div className="min-w-0 flex flex-col gap-0.5 leading-tight">
              <span className="text-base font-semibold tracking-tight text-neutral-50 sm:text-lg">
                Doc<span className="text-emerald-400">Cy</span>
              </span>
              <span
                className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-200/95 sm:text-[11px] sm:tracking-[0.2em]"
                aria-label="Cyprus Health and Wellness"
              >
                CYPRUS HEALTH & WELLNESS
              </span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col justify-center py-8 lg:py-12">
          <section className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)] lg:gap-12">
            <div className="min-w-0">
              <h1
                className={`max-w-3xl text-balance font-semibold tracking-tight text-neutral-50 ${
                  isGreek
                    ? "text-4xl leading-[1.14] sm:text-[2.35rem] sm:leading-[1.12] lg:text-[2.85rem] lg:leading-[1.08] xl:text-[3.05rem]"
                    : "text-4xl sm:text-5xl sm:leading-[1.08] lg:text-[3.2rem] lg:leading-[1.04] xl:text-[3.5rem]"
                }`}
              >
                {t("Hero.title")}
              </h1>

              <p className="mt-8 flex max-w-2xl flex-col gap-3 text-base leading-8 text-neutral-200 sm:text-lg sm:leading-9">
                <span>{t("Hero.subtitleLine1")}</span>
                {t("Hero.subtitleLine2") ? <span>{t("Hero.subtitleLine2")}</span> : null}
              </p>
              <p className="mt-7 whitespace-pre-line text-lg font-medium leading-relaxed text-emerald-100/95 sm:text-xl">
                {t("Hero.kicker")}
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <PendingLink
                  href="#founders-pricing-card"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_28px_rgba(16,185,129,0.55),0_0_56px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300 hover:shadow-[0_0_0_1px_rgba(110,231,183,0.5),0_0_36px_rgba(52,211,153,0.65),0_0_72px_rgba(16,185,129,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
                >
                  {t("Hero.ctaClaim")}
                </PendingLink>

                <ProfessionalAccessButton />
              </div>

            </div>

            <aside className="relative hidden min-h-[390px] lg:block" aria-hidden>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-72 w-72 rounded-full border border-emerald-300/30 bg-emerald-500/8 shadow-[0_0_90px_-28px_rgba(16,185,129,0.6)]" />
                <div className="absolute h-56 w-56 rounded-full border border-emerald-200/25" />
                <div className="absolute h-40 w-40 rounded-full border border-emerald-200/35 bg-emerald-400/10" />
              </div>

              <div className="absolute left-0 top-10 w-56 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/40">
                <div className="flex items-center gap-2">
                  <CalendarSync className="h-4 w-4 text-emerald-300" aria-hidden />
                  <p className="text-xs font-semibold text-slate-100">{t("Hero.visualIncoming")}</p>
                </div>
              </div>

              <div className="absolute right-2 top-36 w-60 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-teal-300/40">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-300" aria-hidden />
                  <p className="text-xs font-semibold text-slate-100">
                    {t("Hero.visualNoInterruptions")}
                  </p>
                </div>
              </div>

              <div className="absolute bottom-12 left-12 w-56 rounded-2xl border border-emerald-300/40 bg-emerald-400/12 p-3 shadow-[0_0_30px_-18px_rgba(110,231,183,0.85)] transition duration-300 hover:-translate-y-0.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
                  <p className="text-xs font-semibold text-emerald-100">{t("Hero.visualConfirmed")}</p>
                </div>
              </div>
            </aside>
          </section>
        </div>

        <section id="why-doccy" className="mx-auto w-full max-w-6xl pb-8 pt-2 sm:pb-10 [overflow-anchor:none]">
          <div className="rounded-3xl border border-emerald-300/20 bg-slate-900/65 p-5 shadow-[0_0_56px_-22px_rgba(16,185,129,0.28)] backdrop-blur-md sm:p-7">
            <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300/95">
              {t("Features.eyebrow")}
            </p>
            <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
              {t("Features.title")}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              {t("Features.intro")}
            </p>

            <p className="mt-6 text-sm font-semibold text-slate-200 sm:text-base">
              {t("Features.painHeading")}
            </p>
            <ul className="mt-3 space-y-3">
              {manualBookingPains.map(({ icon: Icon, title, body, iconWell }) => (
                <li
                  key={title}
                  className="flex gap-3 rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-3 sm:gap-4 sm:px-4"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 ${iconWell}`}
                  >
                    <Icon className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} aria-hidden />
                  </div>
                  <p className="min-w-0 pt-0.5 text-sm leading-relaxed text-slate-300 sm:text-base">
                    <span className="font-semibold text-slate-100">{title}:</span> {body}
                  </p>
                </li>
              ))}
            </ul>

            <p className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium leading-relaxed text-emerald-100 sm:text-base">
              {t("Features.closing")}
            </p>
          </div>
        </section>

        <section
          id="adoption-playbook"
          className="mx-auto w-full max-w-6xl pb-8 pt-2 sm:pb-10 [overflow-anchor:none]"
        >
          <div className="rounded-3xl border border-emerald-300/20 bg-slate-900/65 p-5 shadow-[0_0_56px_-22px_rgba(16,185,129,0.28)] backdrop-blur-md sm:p-7">
            <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300/95">
              {t("AdoptionPlaybook.eyebrow")}
            </p>
            <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
              {t("AdoptionPlaybook.title")}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
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
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200/90">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <p className="text-base font-bold leading-snug tracking-tight text-neutral-50">
                        {title}
                      </p>
                      <p className="mt-1 text-sm font-normal leading-snug text-neutral-300">{body}</p>
                      <p className="mt-2 text-xs font-medium leading-relaxed text-emerald-100/90">
                        {adoptionPlaybookResults[idx]}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-5 max-w-3xl rounded-2xl border border-slate-700/80 bg-slate-950/45 px-4 py-3 text-sm leading-relaxed text-slate-300">
              {t("AdoptionPlaybook.closing")}
            </p>
            <div className="mt-4 flex justify-center sm:justify-start">
              <a
                href="#founders-pricing-card"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/45 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100 transition hover:bg-emerald-400/20 hover:text-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
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
          <div className="rounded-3xl border border-emerald-300/20 bg-slate-900/70 p-5 shadow-[0_0_56px_-22px_rgba(16,185,129,0.35)] backdrop-blur-md sm:p-7">
            <div className="mb-4 sm:mb-5">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
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
          <div className="group mb-6 rounded-3xl border border-rose-300/30 bg-gradient-to-br from-slate-900/85 via-slate-900/80 to-rose-950/30 p-5 shadow-[0_0_64px_-22px_rgba(251,113,133,0.32)] backdrop-blur-md transition sm:mb-8 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200/95">
              {t("Visibility.eyebrow")}
            </p>

            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
              {t("Visibility.title")}
            </h2>
            <p className="mt-1 text-sm italic leading-relaxed text-rose-100/90 sm:text-base">
              {t("Visibility.subtitle")}
            </p>

            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-slate-200 sm:text-base">
              {t("Visibility.intro")}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl border border-rose-300/30 bg-rose-950/20 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-rose-200/45">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-100">
                  {t("Visibility.beforeTitle")}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  <li className="flex items-start gap-2 text-sm text-rose-50/95">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden />
                    <span>{t("Visibility.beforePoints.cost")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-rose-50/95">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden />
                    <span>{t("Visibility.beforePoints.tech")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-rose-50/95">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden />
                    <span>{t("Visibility.beforePoints.visibility")}</span>
                  </li>
                </ul>
              </article>

              <article className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-4 shadow-[0_0_28px_-16px_rgba(110,231,183,0.95)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200/60 hover:bg-emerald-400/14">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
                  {t("Visibility.afterTitle")}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  <li className="flex items-start gap-2 text-sm text-emerald-50/95">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                    <span>{t("Visibility.afterPoints.speed")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-emerald-50/95">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                    <span>{t("Visibility.afterPoints.maintenance")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-emerald-50/95">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                    <span>{t("Visibility.afterPoints.authority")}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-emerald-50/95">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                    <span>{t("Visibility.afterPoints.patientTools")}</span>
                  </li>
                </ul>
              </article>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <p className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs font-medium leading-relaxed text-slate-200 transition hover:-translate-y-0.5 hover:border-rose-200/35">
                {t("Visibility.comparison.websiteCost")}
              </p>
              <p className="rounded-xl border border-emerald-300/45 bg-emerald-400/12 px-3 py-2 text-xs font-semibold leading-relaxed text-emerald-100 shadow-[0_0_24px_-14px_rgba(52,211,153,0.8)] transition hover:-translate-y-0.5 hover:bg-emerald-400/18">
                {t("Visibility.comparison.doccyCost")}
              </p>
            </div>

            <p className="mt-5 max-w-4xl rounded-2xl border border-rose-300/25 bg-rose-950/20 px-4 py-3 text-sm leading-relaxed text-rose-100 sm:text-base">
              {t("Visibility.closing")}
            </p>

            <article
              className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-700/80 bg-slate-950/55 px-5 py-6 sm:px-6 sm:py-7"
              aria-labelledby="skepticism-killer-heading"
            >
              <h3
                id="skepticism-killer-heading"
                className="text-center text-lg font-semibold tracking-tight text-neutral-50 sm:text-xl"
              >
                {t("SkepticismKiller.title")}
              </h3>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                <p>{t("SkepticismKiller.p1")}</p>
                <p className="text-slate-200">{t("SkepticismKiller.p2")}</p>
                <p>{t("SkepticismKiller.p3")}</p>
              </div>
            </article>

            <div className="mt-4 flex justify-center">
              <a
                href="#founders-pricing-card"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/45 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100 transition hover:bg-emerald-400/20 hover:text-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
              >
                {t("Visibility.scrollCue")}
                <ChevronDown className="h-3.5 w-3.5 motion-safe:animate-bounce" aria-hidden />
              </a>
            </div>
          </div>

          <div
            id="founders-pricing-card"
            className="mx-auto max-w-lg rounded-3xl border border-emerald-300/20 bg-slate-900/70 p-5 shadow-[0_0_56px_-22px_rgba(16,185,129,0.35)] backdrop-blur-md sm:p-6"
          >
            <header>
              <p className="text-center text-xs font-semibold tracking-[0.18em] text-emerald-300/95">
                {t("Pricing.badge")}
              </p>
              <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight text-neutral-50 sm:text-[1.65rem]">
                {t("Pricing.title")}
              </h2>
              <p className="mt-2 text-center text-sm leading-relaxed text-slate-300">
                {t("Pricing.subtitle")}
              </p>
            </header>

            <FoundersPricingCard embedded />
          </div>
        </section>
        <section className="mx-auto w-full max-w-6xl pb-10 pt-2 sm:pb-12 [overflow-anchor:none]">
          <div className="rounded-3xl border border-emerald-300/20 bg-slate-900/65 p-5 shadow-[0_0_56px_-22px_rgba(16,185,129,0.28)] backdrop-blur-md sm:p-7">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
              {t("FAQ.heading")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              {t("FAQ.intro")}
            </p>

            <div className="mt-5 space-y-3">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-slate-700/80 bg-slate-950/40 p-4 transition hover:border-emerald-300/40"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-left">
                    <span className="text-sm font-semibold leading-snug text-neutral-100 sm:text-base">
                      {item.question}
                    </span>
                    <ChevronDown
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300 transition group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="mt-3 space-y-2">
                    {item.answers.map((answer) => (
                      <p key={answer} className="text-sm leading-relaxed text-slate-300">
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
      <MarketingFooter />
    </main>
  );
}
