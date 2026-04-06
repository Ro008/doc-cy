"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Slide = {
  title: string;
  body: string;
  imageSrc: string;
  categoryLabel: string;
  device: "phone" | "desktop";
  mobileDesktopFrameClass?: string;
  mobileDesktopImageClass?: string;
  /**
   * Desktop captures that are wider than a phone mockup: show the full image
   * (object-contain, capped height) instead of a fixed-aspect fill crop.
   */
  desktopWideCapture?: boolean;
};

export function ProductShowcaseCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);
  const activeSlide = slides[index];

  const total = slides.length;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  function prev() {
    setIndex((v) => (v > 0 ? v - 1 : v));
  }

  function next() {
    setIndex((v) => (v < total - 1 ? v + 1 : v));
  }

  if (total === 0 || !activeSlide) return null;

  return (
    <section
      className="rounded-3xl border border-emerald-300/20 bg-slate-900/65 p-4 shadow-[0_0_56px_-22px_rgba(16,185,129,0.25)] backdrop-blur-md sm:p-6"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        touchStartX.current = null;
        if (start == null || end == null) return;
        const delta = end - start;
        if (Math.abs(delta) < 40) return;
        if (delta < 0) next();
        if (delta > 0) prev();
      }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/55">
        <article className="w-full p-3 sm:p-4">
          <div className="mx-auto mb-2 flex w-full max-w-[760px] justify-start">
            <span className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              {activeSlide?.categoryLabel}
            </span>
          </div>
          <div
            className={`relative mx-auto overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/60 shadow-xl shadow-black/40 ${
              activeSlide?.device === "phone"
                ? "aspect-[9/19] w-full max-w-[280px] sm:max-w-[320px]"
                : activeSlide?.desktopWideCapture
                  ? "w-full max-w-[760px]"
                  : `w-full max-w-[760px] ${
                      activeSlide?.mobileDesktopFrameClass ??
                      "aspect-[4/3] sm:h-auto sm:aspect-[16/10]"
                    }`
            }`}
          >
            {activeSlide?.device === "desktop" ? (
              <div
                className={
                  activeSlide.desktopWideCapture
                    ? "relative z-10 flex h-8 items-center gap-1.5 border-b border-slate-700/80 bg-slate-900/90 px-3"
                    : "absolute inset-x-0 top-0 z-10 hidden h-8 items-center gap-1.5 border-b border-slate-700/80 bg-slate-900/90 px-3 sm:flex"
                }
              >
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 text-[10px] font-medium text-slate-400">mydoccy.com</span>
              </div>
            ) : null}
            {activeSlide?.device === "desktop" && activeSlide.desktopWideCapture ? (
              <div className="flex justify-center bg-slate-950/35 px-2 py-3 sm:px-4 sm:py-4">
                <Image
                  src={activeSlide.imageSrc}
                  alt={activeSlide.title}
                  width={1920}
                  height={1080}
                  className="h-auto max-h-[min(72vh,640px)] w-full max-w-full object-contain object-top"
                  sizes="(max-width: 1024px) 92vw, 760px"
                />
              </div>
            ) : (
              <div
                className={`relative h-full w-full ${activeSlide?.device === "desktop" ? "sm:pt-8" : ""}`}
              >
                <Image
                  src={activeSlide.imageSrc}
                  alt={activeSlide.title}
                  fill
                  className={
                    activeSlide.device === "desktop"
                      ? `${activeSlide.mobileDesktopImageClass ?? "object-contain sm:object-cover sm:object-top"}`
                      : "object-cover"
                  }
                  sizes={
                    activeSlide.device === "desktop"
                      ? "(max-width: 1024px) 92vw, 760px"
                      : "(max-width: 640px) 280px, 320px"
                  }
                />
              </div>
            )}
          </div>
        </article>

        <button
          type="button"
          onClick={prev}
          disabled={!canPrev}
          aria-label="Previous slide"
          className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-600/70 bg-slate-900/80 text-slate-200 transition hover:border-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={next}
          disabled={!canNext}
          aria-label="Next slide"
          className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-600/70 bg-slate-900/80 text-slate-200 transition hover:border-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-auto mt-4 max-w-2xl text-center">
        <h3 className="text-base font-semibold text-slate-100 sm:text-lg">
          {activeSlide?.title}
        </h3>
        <p className="mt-1 text-sm text-slate-300">{activeSlide?.body}</p>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
        <span className="tabular-nums">
          {index + 1} / {total}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={`${slide.title}-dot`}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index ? "true" : undefined}
            className={`h-2.5 rounded-full transition ${
              i === index ? "w-7 bg-emerald-300" : "w-2.5 bg-slate-500 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

