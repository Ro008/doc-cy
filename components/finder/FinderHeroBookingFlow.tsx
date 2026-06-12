import Image from "next/image";
import { CalendarCheck, Check } from "lucide-react";

/** Vertical offset for hero headline copy. */
export const FINDER_HERO_COPY_TOP_CLASS = "top-2 sm:top-[4%] lg:top-[6%]";

/** Vertical offset for booking-flow overlay (aligned with copy previously). */
export const FINDER_HERO_CONTENT_TOP_CLASS = "top-6 sm:top-[10%] lg:top-[12%]";

function DoctorNikosAvatar({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border-2 border-white/90 shadow-md ${className}`}
      aria-hidden
    >
      <Image
        src="/finder/dr-nikos.png"
        alt=""
        width={72}
        height={72}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flex justify-end pr-5" aria-hidden>
      <svg width="20" height="28" viewBox="0 0 20 28" fill="none" className="text-emerald-400/55">
        <path
          d="M10 0v20M10 20l-4-4M10 20l4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 3"
        />
      </svg>
    </div>
  );
}

export function FinderHeroBookingFlow() {
  return (
    <div
      className={`pointer-events-none absolute right-[5%] z-[5] hidden w-[min(100%,12.75rem)] flex-col sm:flex lg:right-[6%] lg:w-56 xl:right-[7%] xl:w-[15rem] ${FINDER_HERO_CONTENT_TOP_CLASS}`}
      aria-hidden
    >
      {/* Patient sends booking request */}
      <div className="ml-auto max-w-[11.75rem] rounded-2xl rounded-br-sm border border-white/25 bg-white/94 px-3 py-2.5 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Booking request
        </p>
        <p className="mt-1 text-[13px] font-semibold leading-snug text-slate-900">Dr. Andreas Nikos</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600">
          <CalendarCheck className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
          Tue 10:30 · General Practice
        </p>
      </div>

      <div className="my-1">
        <FlowConnector />
      </div>

      {/* DocCy auto-confirmation */}
      <div className="flex items-start gap-3">
        <DoctorNikosAvatar />
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-emerald-400/30 bg-white/94 px-3 py-2.5 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.45)] backdrop-blur-sm">
          <p className="flex items-center gap-1 text-[13px] font-bold leading-snug text-emerald-600">
            <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
            Appointment confirmed
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            With Dr. Andreas Nikos — added to your calendar
          </p>
        </div>
      </div>
    </div>
  );
}
