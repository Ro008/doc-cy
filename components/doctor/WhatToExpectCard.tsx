import { CalendarCheck2 } from "lucide-react";

/**
 * Standalone callout so "What to expect" is visible on mobile without opening the About accordion.
 */
export function WhatToExpectCard() {
  return (
    <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4 shadow-lg shadow-slate-950/20 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-emerald-200">
        <CalendarCheck2 className="h-4 w-4 text-emerald-300" aria-hidden />
        <p className="text-xs font-semibold tracking-[0.2em] text-emerald-200/90">
          What to expect
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
        Book in seconds. Your appointment is instantly synced with the
        doctor&apos;s agenda. You&apos;ll receive a confirmation email with a
        one-click WhatsApp link to contact the clinic and a direct button to
        add the date to your calendar.
      </p>
    </div>
  );
}
