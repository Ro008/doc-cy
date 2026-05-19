"use client";

import * as React from "react";
import { Check, Info } from "lucide-react";
import { MAX_FOUNDERS, type FoundersAvailability } from "@/lib/founders-club";
import { useTranslations } from "next-intl";
import { PendingLink } from "@/components/navigation/PendingLink";

const BAR_MS = 1100;
const COUNT_MS = 950;
type PricingFeature = {
  label: string;
  highlighted?: boolean;
};

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

type FoundersPricingCardProps = {
  /** Renders inside the landing pricing shell (no nested card chrome). */
  embedded?: boolean;
};

export function FoundersPricingCard({ embedded = false }: FoundersPricingCardProps) {
  const t = useTranslations("LandingPage");
  const rootRef = React.useRef<HTMLElement | null>(null);
  const [showDirectoryNote, setShowDirectoryNote] = React.useState(false);
  const [availability, setAvailability] = React.useState<FoundersAvailability | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [inView, setInView] = React.useState(false);
  const [barShownPct, setBarShownPct] = React.useState(0);
  const [displaySpots, setDisplaySpots] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6000);

    async function loadAvailability() {
      try {
        const response = await fetch("/api/pricing/founders-availability", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`availability fetch failed: ${response.status}`);
        const data = (await response.json()) as FoundersAvailability;
        if (cancelled) return;
        setAvailability(data);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setStatus("error");
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    loadAvailability();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setInView(true);
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: [0, 0.2, 0.4] }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const showFounderOffer = status === "ready" && Boolean(availability?.offerAvailable);
  const spotsRemaining = availability?.spotsRemaining ?? 0;
  const progressPercent = availability?.progressPercent ?? 100;
  const founderFeatures: PricingFeature[] = [
    { label: t("Pricing.benefits.seoProfilePage") },
    { label: t("Pricing.benefits.appointments") },
    { label: t("Pricing.benefits.support") },
    { label: t("Pricing.benefits.directoryPriority"), highlighted: true },
  ];
  const standardFeatures: PricingFeature[] = [
    { label: t("Pricing.benefits.appointments") },
    { label: t("Pricing.benefits.support") },
  ];
  const features = showFounderOffer ? founderFeatures : standardFeatures;

  /** Fetch settled (or failed); section visible — drive “live” counter + bar */
  const revealLive = inView && status !== "loading";

  React.useEffect(() => {
    if (!revealLive) return;

    let raf = 0;
    let cancelled = false;

    if (showFounderOffer) {
      setBarShownPct(0);
      setDisplaySpots(null);
      const start = performance.now();

      const tick = (now: number) => {
        if (cancelled) return;
        const tBar = Math.min(1, (now - start) / BAR_MS);
        const tCount = Math.min(1, (now - start) / COUNT_MS);
        setBarShownPct(progressPercent * easeOutQuad(tBar));
        if (tCount >= 0.06) {
          setDisplaySpots(Math.round(spotsRemaining * easeOutQuad(tCount)));
        }
        if (tBar < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          setBarShownPct(progressPercent);
          setDisplaySpots(spotsRemaining);
        }
      };

      raf = requestAnimationFrame(tick);
    } else {
      setDisplaySpots(null);
      setBarShownPct(0);
      const start = performance.now();

      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / BAR_MS);
        setBarShownPct(100 * easeOutQuad(t));
        if (t < 1) raf = requestAnimationFrame(tick);
        else setBarShownPct(100);
      };

      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [revealLive, showFounderOffer, progressPercent, spotsRemaining]);

  return (
    <aside
      ref={rootRef}
      className={
        embedded
          ? "mt-5 border-t border-emerald-300/20 pt-5 [overflow-anchor:none]"
          : "rounded-2xl border border-emerald-300/30 bg-slate-950/70 p-5 shadow-[0_0_40px_-16px_rgba(52,211,153,0.45)] [overflow-anchor:none]"
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {showFounderOffer ? (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex w-fit rounded-full border border-emerald-300/50 bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-200">
                {t("Pricing.threeMonthsFree")}
              </span>
              <span className="inline-flex w-fit rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-100/90">
                {t("Pricing.foundingMemberStatus")}
              </span>
            </div>
          ) : (
            <span className="mx-auto inline-flex rounded-full border border-slate-600/70 bg-slate-800/70 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-slate-200 sm:mx-0">
              {t("Pricing.standardPricing")}
            </span>
          )}
        </div>

        <div className="text-center sm:text-right">
          {status === "loading" ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">{t("Pricing.loading")}</p>
              <div className="mx-auto h-7 w-24 animate-pulse rounded bg-slate-700/70 sm:ml-auto sm:mr-0" aria-hidden />
            </div>
          ) : showFounderOffer ? (
            <div className="flex flex-col items-center gap-0.5 sm:items-end">
              <p className="relative inline-block text-sm font-semibold text-slate-400">
                <span>{t("Pricing.oldPrice")}</span>
                <span
                  className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-[62%] bg-rose-200/95"
                  aria-hidden
                />
              </p>
              <p className="text-2xl font-bold tracking-tight text-neutral-50 sm:text-[1.75rem]">
                {t("Pricing.price")}
              </p>
            </div>
          ) : (
            <p className="text-2xl font-bold tracking-tight text-neutral-50 sm:text-[1.75rem]">
              {t("Pricing.oldPrice")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {status === "loading" ? (
          <p className="text-xs text-slate-400">{t("Pricing.loading")}</p>
        ) : showFounderOffer ? (
          <p className="text-center text-xs text-emerald-200/95 sm:text-left">
            {t.rich("Pricing.limited", {
              count:
                revealLive && displaySpots !== null
                  ? displaySpots
                  : spotsRemaining || MAX_FOUNDERS,
              spots: (chunks) => (
                <span className="inline-flex items-center rounded-md bg-emerald-300/20 px-1.5 py-0.5 font-semibold text-emerald-100 shadow-[0_0_16px_-6px_rgba(110,231,183,0.9)] animate-pulse">
                  {chunks}
                </span>
              ),
            })}
          </p>
        ) : (
          <p className="text-center text-xs text-slate-400 sm:text-left">
            {t("Pricing.foundersUnavailable")}
          </p>
        )}

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/90">
          {status === "loading" && inView ? (
            <div
              className="h-full w-[30%] rounded-full bg-emerald-300/45 animate-pulse"
              aria-hidden
            />
          ) : (
            <div
              className={`h-full rounded-full ${
                showFounderOffer ? "bg-emerald-300/90" : "bg-slate-500/80"
              }`}
              style={{ width: `${revealLive ? barShownPct : 0}%` }}
              aria-hidden
            />
          )}
        </div>

        {showFounderOffer ? (
          <p className="text-center text-[11px] leading-relaxed text-emerald-100/85">
            {t("Pricing.trustLine")}
          </p>
        ) : null}
      </div>

      <ul className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-2 sm:gap-x-4">
        {features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2">
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300"
              strokeWidth={2.5}
              aria-hidden
            />
            <span className="inline-flex items-center gap-1.5 leading-snug">
              {feature.label}
              {feature.highlighted ? (
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full p-0.5 text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
                    aria-label={t("Pricing.benefits.directoryPriorityNote")}
                    aria-expanded={showDirectoryNote}
                    onClick={() => setShowDirectoryNote((prev) => !prev)}
                    onBlur={() => setShowDirectoryNote(false)}
                  >
                    <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  </button>
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute right-0 top-full z-10 mt-2 w-52 max-w-[min(16rem,calc(100vw-1.5rem))] rounded-md border border-slate-600/70 bg-slate-900/95 p-2 text-[11px] leading-relaxed text-slate-300 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:left-0 sm:right-auto ${
                      showDirectoryNote ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {t("Pricing.benefits.directoryPriorityNote")}
                  </span>
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <PendingLink
        href="/register"
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_28px_rgba(16,185,129,0.55),0_0_56px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300 hover:shadow-[0_0_0_1px_rgba(110,231,183,0.5),0_0_36px_rgba(52,211,153,0.65),0_0_72px_rgba(16,185,129,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
      >
        {t("Pricing.cta")}
      </PendingLink>
    </aside>
  );
}
