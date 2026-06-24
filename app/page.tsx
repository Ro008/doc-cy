// app/page.tsx
import {
  CalendarSync,
  ChevronDown,
  Globe,
  LayoutTemplate,
  PhoneCall,
  Quote,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FoundersPricingCard } from "@/components/landing/FoundersPricingCard";
import { HeroDoctorVisual } from "@/components/landing/HeroDoctorVisual";
import { HomeLandingScroll } from "@/components/landing/HomeLandingScroll";
import { getTranslations, getLocale } from "next-intl/server";
import { PendingLink } from "@/components/navigation/PendingLink";
import { ProfessionalAccessButton } from "@/components/landing/ProfessionalAccessButton";
import { MarketingFooter } from "@/components/navigation/MarketingFooter";
import { SupportInquiryLink } from "@/components/landing/SupportInquiryLink";

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

  const heroMetrics = [
    { label: t("Hero.metrics.freeTrial.label"), detail: t("Hero.metrics.freeTrial.detail") },
    { label: t("Hero.metrics.cyprus.label"), detail: t("Hero.metrics.cyprus.detail") },
    { label: t("Hero.metrics.approvals.label"), detail: t("Hero.metrics.approvals.detail") },
    { label: t("Hero.metrics.support.label"), detail: t("Hero.metrics.support.detail") },
  ];

  const whatIsItems: { icon: LucideIcon; title: string; body: string }[] = [
    {
      icon: CalendarSync,
      title: t("WhatIsDocCy.items.agenda.title"),
      body: t("WhatIsDocCy.items.agenda.body"),
    },
    {
      icon: LayoutTemplate,
      title: t("WhatIsDocCy.items.storefront.title"),
      body: t("WhatIsDocCy.items.storefront.body"),
    },
    {
      icon: ShieldCheck,
      title: t("WhatIsDocCy.items.shield.title"),
      body: t("WhatIsDocCy.items.shield.body"),
    },
  ];

  const challengeItems: {
    icon: LucideIcon;
    category: string;
    title: string;
    body: string;
    iconWell: string;
  }[] = [
    {
      icon: Search,
      category: t("Challenges.items.visibility.category"),
      title: t("Challenges.items.visibility.title"),
      body: t("Challenges.items.visibility.body"),
      iconWell: "bg-clinical-100 text-clinical-700 ring-1 ring-clinical-200",
    },
    {
      icon: PhoneCall,
      category: t("Challenges.items.productivity.category"),
      title: t("Challenges.items.productivity.title"),
      body: t("Challenges.items.productivity.body"),
      iconWell: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    },
    {
      icon: Globe,
      category: t("Challenges.items.weekendShield.category"),
      title: t("Challenges.items.weekendShield.title"),
      body: t("Challenges.items.weekendShield.body"),
      iconWell: "bg-wellness-50 text-wellness-800 ring-1 ring-wellness-200",
    },
  ];

  const howItWorksSteps = [
    {
      title: t("HowItWorks.steps.profile.title"),
      body: t("HowItWorks.steps.profile.body"),
    },
    {
      title: t("HowItWorks.steps.requests.title"),
      body: t("HowItWorks.steps.requests.body"),
    },
    {
      title: t("HowItWorks.steps.sync.title"),
      body: t("HowItWorks.steps.sync.body"),
    },
  ];

  const testimonials = [
    {
      body: t("Testimonials.quotes.paphos.body"),
      attribution: t("Testimonials.quotes.paphos.attribution"),
    },
    {
      body: t("Testimonials.quotes.assistant.body"),
      attribution: t("Testimonials.quotes.assistant.attribution"),
    },
  ];

  const pricingTiers = [
    t("Pricing.tierFree"),
    t("Pricing.tierFounder"),
    t("Pricing.tierStandard"),
  ];

  const faqItems = [
    {
      question: t("FAQ.items.doubleBookings.question"),
      answers: [t("FAQ.items.doubleBookings.answer1")],
    },
    {
      question: t("FAQ.items.patientHabit.question"),
      answers: [t("FAQ.items.patientHabit.answer1")],
    },
    {
      question: t("FAQ.items.setupTime.question"),
      answers: [t("FAQ.items.setupTime.answer1")],
      contactCta: t("FAQ.items.setupTime.contactCta"),
    },
  ];

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-ink-50 text-ink-800 [overflow-anchor:none]">
      <HomeLandingScroll />
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

        {/* Block 1: Hero */}
        <div className="flex min-h-0 flex-1 flex-col justify-center py-8 lg:py-12">
          <section className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(400px,580px)] lg:items-stretch lg:gap-10">
            <div className="min-w-0">
              <h1
                className={`max-w-3xl text-balance font-semibold tracking-tight text-ink-900 ${
                  isGreek
                    ? "text-4xl leading-[1.14] sm:text-[2.35rem] sm:leading-[1.12] lg:text-[2.85rem] lg:leading-[1.08]"
                    : "text-4xl sm:text-5xl sm:leading-[1.08] lg:text-[3.2rem] lg:leading-[1.04]"
                }`}
              >
                {t("Hero.title")}
              </h1>

              <p className="mt-4 max-w-2xl text-xl font-medium leading-snug text-wellness-700 sm:text-2xl">
                {t("Hero.tagline")}
              </p>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-600 sm:text-lg">
                {t("Hero.subheader")}
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <PendingLink href="#founders-pricing-card" className={landingCtaClass}>
                  {t("Hero.ctaClaim")}
                </PendingLink>
                <ProfessionalAccessButton />
              </div>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {heroMetrics.map(({ label, detail }) => (
                  <li
                    key={label}
                    className="rounded-xl border border-ink-200 bg-white/80 px-3 py-3 backdrop-blur-sm"
                  >
                    <p className="text-sm font-semibold text-ink-900">{label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            <HeroDoctorVisual />
          </section>
        </div>

        {/* Block 2: What is DocCy */}
        <section id="what-is-doccy" className="mx-auto w-full max-w-6xl pb-8 pt-2 sm:pb-10">
          <div className={landingSectionShell}>
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {t("WhatIsDocCy.title")}
            </h2>
            <ul className="mt-6 grid gap-4 lg:grid-cols-3">
              {whatIsItems.map(({ icon: Icon, title, body }) => (
                <li key={title} className={benefitCardShell}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-clinical-50 text-clinical-600 ring-1 ring-clinical-200">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </div>
                  <p className="mt-4 text-base font-semibold text-ink-900">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Block 3: Challenges */}
        <section id="challenges" className="mx-auto w-full max-w-6xl pb-8 pt-2 sm:pb-10">
          <div className={landingSectionShell}>
            <p className="text-xs font-semibold tracking-[0.18em] text-clinical-600">
              {t("Challenges.eyebrow")}
            </p>
            <ul className="mt-6 grid gap-4 lg:grid-cols-3">
              {challengeItems.map(({ icon: Icon, category, title, body, iconWell }) => (
                <li key={title} className={benefitCardShell}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-clinical-600">
                    {category}
                  </p>
                  <div className="mt-3 flex gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconWell}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-ink-900">{title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Block 4: How it works */}
        <section id="how-it-works" className="mx-auto w-full max-w-6xl pb-8 pt-2 sm:pb-10">
          <div className={landingSectionShell}>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {t("HowItWorks.title")}
            </h2>
            <ol className="mt-6 space-y-4">
              {howItWorksSteps.map(({ title, body }, index) => (
                <li
                  key={title}
                  className="flex gap-4 rounded-2xl border border-ink-200 bg-ink-50 px-4 py-4"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clinical-500 text-sm font-bold text-white"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Block 5: Testimonials */}
        <section id="testimonials" className="mx-auto w-full max-w-6xl pb-8 pt-2 sm:pb-10">
          <div className={landingSectionShell}>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {t("Testimonials.title")}
            </h2>
            <ul className="mt-6 grid gap-4 lg:grid-cols-2">
              {testimonials.map(({ body, attribution }) => (
                <li
                  key={attribution}
                  className="rounded-2xl border border-ink-200 bg-clinical-50/50 p-5"
                >
                  <Quote className="h-5 w-5 text-clinical-400" aria-hidden />
                  <blockquote className="mt-3 text-sm leading-relaxed text-ink-700 sm:text-base">
                    {body}
                  </blockquote>
                  <p className="mt-4 text-sm font-semibold text-ink-900">— {attribution}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Block 6: Pricing */}
        <section
          id="founders-pricing"
          className="mx-auto w-full max-w-6xl pb-10 pt-4 sm:pb-10"
        >
          <div className={landingSectionShell}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clinical-600">
              {t("Pricing.badge")}
            </p>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {t("Pricing.sectionTitle")}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-600 sm:text-base">
              {t("Pricing.sectionIntro")}
            </p>
            <ul className="mt-5 space-y-2 text-sm leading-relaxed text-ink-700 sm:text-base">
              {pricingTiers.map((tier) => (
                <li key={tier} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-clinical-500" aria-hidden />
                  <span>{tier}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-medium text-ink-500 sm:text-sm">
              {t("Pricing.finePrint")}
            </p>

            <div
              id="founders-pricing-card"
              className="mx-auto mt-8 max-w-lg rounded-3xl border border-clinical-200 bg-white p-5 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_28px_rgba(11,123,181,0.08)] sm:p-6"
            >
              <header>
                <h3 className="text-center text-2xl font-semibold tracking-tight text-ink-900 sm:text-[1.65rem]">
                  {t("Pricing.title")}
                </h3>
                <p className="mt-2 text-center text-sm leading-relaxed text-ink-500">
                  {t("Pricing.subtitle")}
                </p>
              </header>
              <FoundersPricingCard embedded />
            </div>
          </div>
        </section>

        {/* Block 7: FAQ */}
        <section className="mx-auto w-full max-w-6xl pb-10 pt-2 sm:pb-12">
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
                    {"contactCta" in item && item.contactCta ? (
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
