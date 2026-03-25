"use client";

import Link from "next/link";
import * as React from "react";
import { MAX_FOUNDERS, type FoundersAvailability } from "@/lib/founders-club";
import { useTranslations } from "next-intl";

const BAR_MS = 1100;
const COUNT_MS = 950;

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function FoundersPricingCard() {
  const t = useTranslations("LandingPage");
  const rootRef = React.useRef<HTMLElement | null>(null);
  const [availability, setAvailability] = React.useState<FoundersAvailability | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [inView, setInView] = React.useState(false);
  const [barShownPct, setBarShownPct] = React.useState(0);
  const [displaySpots, setDisplaySpots] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      try {
        const response = await fetch("/api/pricing/founders-availability", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`availability fetch failed: ${response.status}`);
        const data = (await response.json()) as FoundersAvailability;
        if (cancelled) return;
        setAvailability(data);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setStatus("error");
      }
    }

    loadAvailability();
    return () => {
      cancelled = true;
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
  const founderFeatures = [
    t("Pricing.benefits.price"),
    t("Pricing.benefits.appointments"),
    t("Pricing.benefits.support"),
  ];
  const standardFeatures = [
    t("Pricing.benefits.appointments"),
    t("Pricing.benefits.support"),
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
      className="rounded-2xl border border-emerald-300/30 bg-slate-950/70 p-5 shadow-[0_0_40px_-16px_rgba(52,211,153,0.45)] [overflow-anchor:none] lg:min-h-[430px]"
    >
      {showFounderOffer ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="inline-flex w-fit rounded-full border border-emerald-300/50 bg-emerald-400/15 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-200">
            {t("Pricing.threeMonthsFree")}
          </span>
          <span className="inline-flex w-fit rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100/90">
            {t("Pricing.foundingMemberStatus")}
          </span>
        </div>
      ) : (
        <span className="inline-flex rounded-full border border-slate-600/70 bg-slate-800/70 px-3 py-1 text-xs font-semibold tracking-wide text-slate-200">
          {t("Pricing.standardPricing")}
        </span>
      )}

      <div className="mt-4">
        {status === "loading" ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">{t("Pricing.loading")}</p>
            <div className="h-6 w-28 animate-pulse rounded bg-slate-700/70" aria-hidden />
          </div>
        ) : showFounderOffer ? (
          <>
            <p className="relative inline-block text-base font-semibold text-slate-100">
              <span>{t("Pricing.oldPrice")}</span>
              <span
                className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-[62%] bg-rose-200/95"
                aria-hidden
              />
            </p>
            <p className="text-3xl font-bold tracking-tight text-neutral-50">{t("Pricing.price")}</p>
          </>
        ) : (
          <p className="text-3xl font-bold tracking-tight text-neutral-50">{t("Pricing.oldPrice")}</p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {status === "loading" ? (
          <p className="text-xs text-slate-400">{t("Pricing.loading")}</p>
        ) : showFounderOffer ? (
          <p className="text-xs text-emerald-200/95">
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
          <p className="text-xs text-slate-400">
            {t("Pricing.foundersUnavailable")}
          </p>
        )}

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800/90">
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
      </div>

      <ul className="mt-5 space-y-2 text-sm text-slate-200 min-h-[88px]">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/register"
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_28px_rgba(16,185,129,0.55),0_0_56px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300 hover:shadow-[0_0_0_1px_rgba(110,231,183,0.5),0_0_36px_rgba(52,211,153,0.65),0_0_72px_rgba(16,185,129,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
      >
        {t("Pricing.cta")}
      </Link>
      {showFounderOffer ? (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-emerald-100/90">
          {t("Pricing.noCard")}
        </p>
      ) : null}
    </aside>
  );
}
