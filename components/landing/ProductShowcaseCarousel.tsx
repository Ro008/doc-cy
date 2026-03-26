"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Slide = {
  title: string;
  body: string;
  imageSrc: string;
};

export function ProductShowcaseCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);

  const total = slides.length;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  function prev() {
    setIndex((v) => (v > 0 ? v - 1 : v));
  }

  function next() {
    setIndex((v) => (v < total - 1 ? v + 1 : v));
  }

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
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide) => (
            <article key={slide.title} className="w-full shrink-0 p-3 sm:p-4">
              <div className="relative mx-auto aspect-[9/19] w-full max-w-[280px] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/60 shadow-xl shadow-black/40 sm:max-w-[320px]">
                <Image
                  src={slide.imageSrc}
                  alt={slide.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 280px, 320px"
                  unoptimized
                />
              </div>
              <div className="mx-auto mt-4 max-w-2xl text-center">
                <h3 className="text-base font-semibold text-slate-100 sm:text-lg">
                  {slide.title}
                </h3>
                <p className="mt-1 text-sm text-slate-300">{slide.body}</p>
              </div>
            </article>
          ))}
        </div>

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

      <div className="mt-4 flex items-center justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={`${slide.title}-dot`}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index ? "true" : undefined}
            className={`h-2.5 rounded-full transition ${
              i === index ? "w-6 bg-emerald-300" : "w-2.5 bg-slate-600 hover:bg-slate-500"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

