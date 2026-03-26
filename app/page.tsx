// app/page.tsx
import Link from "next/link";
import { CalendarSync, ShieldCheck, UserRound } from "lucide-react";
import { FoundersPricingCard } from "@/components/landing/FoundersPricingCard";
import { HomeLandingScroll } from "@/components/landing/HomeLandingScroll";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { getTranslations, getLocale } from "next-intl/server";
import { ProductShowcaseCarousel } from "@/components/landing/ProductShowcaseCarousel";

type Benefit = {
  icon: typeof CalendarSync;
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

  const benefits: Benefit[] = [
    {
      icon: CalendarSync,
      title: t("Features.syncTitle"),
      body: t("Features.syncDesc"),
      iconWell:
        "bg-emerald-400/25 text-emerald-300 shadow-[0_0_24px_-4px_rgba(52,211,153,0.55)] ring-2 ring-emerald-400/50",
    },
    {
      icon: ShieldCheck,
      title: t("Features.confirmTitle"),
      body: t("Features.confirmDesc"),
      iconWell:
        "bg-teal-400/30 text-teal-200 shadow-[0_0_24px_-4px_rgba(45,212,191,0.5)] ring-2 ring-teal-300/55",
    },
    {
      icon: UserRound,
      title: t("Features.profileTitle"),
      body: t("Features.profileDesc"),
      iconWell:
        "bg-sky-400/30 text-sky-200 shadow-[0_0_24px_-4px_rgba(56,189,248,0.5)] ring-2 ring-sky-300/55",
    },
  ];

  const showcaseSlides = [
    {
      title: t("Showcase.slides.profile.title"),
      body: t("Showcase.slides.profile.body"),
      imageSrc: "/showcase/01-profile.png",
    },
    {
      title: t("Showcase.slides.calendar.title"),
      body: t("Showcase.slides.calendar.body"),
      imageSrc: "/showcase/02-calendar.png",
    },
    {
      title: t("Showcase.slides.confirmation.title"),
      body: t("Showcase.slides.confirmation.body"),
      imageSrc: "/showcase/03-confirmation.png",
    },
    {
      title: t("Showcase.slides.sync.title"),
      body: t("Showcase.slides.sync.body"),
      imageSrc: "/showcase/04-google-calendar.png",
    },
    {
      title: t("Showcase.slides.agenda.title"),
      body: t("Showcase.slides.agenda.body"),
      imageSrc: "/showcase/05-doctor-agenda.png",
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
        <header className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/90 text-xs font-bold tracking-tight text-neutral-950 shadow-lg shadow-emerald-500/35 sm:h-10 sm:w-10 sm:text-sm">
            DC
          </span>
          <div className="min-w-0 flex flex-col gap-0.5 leading-tight">
            <span className="text-base font-semibold tracking-tight text-neutral-50 sm:text-lg">
              Doc<span className="text-emerald-400">Cy</span>
            </span>
            <span
              className="text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-200/95 sm:text-xs sm:tracking-[0.24em]"
              aria-label="Cyprus Health"
            >
              Cyprus Health
            </span>
          </div>
          </div>
          <div className="shrink-0">
            <LanguageSwitcher />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col justify-center py-3 lg:py-4">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:gap-10 xl:gap-12">
            <section className="min-w-0 flex-1 lg:max-w-[58%]">
              <h1
                className={`text-balance whitespace-pre-line font-semibold tracking-tight text-neutral-50 ${
                  isGreek
                    ? "text-3xl leading-[1.16] sm:text-[2rem] sm:leading-[1.14] lg:text-[2.15rem] lg:leading-[1.12] xl:text-[2.3rem]"
                    : "text-3xl sm:text-4xl sm:leading-[1.12] lg:text-[2.2rem] lg:leading-[1.12] xl:text-[2.35rem]"
                }`}
              >
                {t("Hero.title")}
              </h1>

              <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-neutral-200 sm:text-base">
                {t("Hero.subtitle")}
              </p>

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_28px_rgba(16,185,129,0.55),0_0_56px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300 hover:shadow-[0_0_0_1px_rgba(110,231,183,0.5),0_0_36px_rgba(52,211,153,0.65),0_0_72px_rgba(16,185,129,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
                >
                  {t("Hero.ctaClaim")}
                </Link>

                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl border-2 border-white/45 bg-neutral-800/90 px-5 py-2.5 text-sm font-semibold text-neutral-50 shadow-md shadow-black/30 backdrop-blur transition hover:border-white/65 hover:bg-neutral-700/95 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
                >
                  {t("Hero.ctaLogin")}
                </Link>
              </div>
            </section>

            <div className="flex w-full min-w-0 shrink-0 justify-center lg:w-[38%] lg:max-w-md lg:justify-end">
              <aside
                className="w-full max-w-md lg:mx-0"
                aria-labelledby="benefits-heading"
              >
                <h2
                  id="benefits-heading"
                  className="text-lg font-bold tracking-tight text-neutral-50"
                >
                  {t("Features.heading")}
                </h2>

                <ul className="mt-4 flex flex-col gap-5 sm:gap-6">
                  {benefits.map(({ icon: Icon, title, body, iconWell }) => (
                    <li key={title} className={benefitCardShell}>
                      <div className="flex gap-4 sm:gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14 ${iconWell}`}
                        >
                          <Icon
                            className="h-6 w-6 sm:h-7 sm:w-7"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold leading-snug tracking-tight text-neutral-50">
                            {title}
                          </p>
                          <p className="mt-0.5 text-sm font-normal leading-snug text-neutral-300">
                            {body}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </div>

        <section className="mx-auto w-full max-w-6xl pb-6 pt-1 sm:pb-8">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
              {t("Showcase.title")}
            </h2>
          </div>
          <ProductShowcaseCarousel slides={showcaseSlides} />
        </section>

        <section
          id="founders-pricing"
          className="mx-auto w-full max-w-6xl pb-8 pt-2 sm:pb-10 [overflow-anchor:none]"
        >
          <div className="rounded-3xl border border-emerald-300/20 bg-slate-900/70 p-5 shadow-[0_0_56px_-22px_rgba(16,185,129,0.35)] backdrop-blur-md sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/95">
                  {t("Pricing.badge")}
                </p>
                <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
                  {t("Pricing.title")}
                </h2>
                <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-950/45 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    {t("Pricing.why90Days")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {t("Pricing.why90Desc")}
                  </p>
                </div>
              </div>

              <FoundersPricingCard />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
