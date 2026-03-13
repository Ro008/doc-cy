// app/page.tsx
import Link from "next/link";
import { ArrowRight, UserRound, CalendarDays, MessageCircle } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Background gradient / glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Top nav / brand */}
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/90 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/30">
              DC
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                DocCy
              </span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                CYPRUS HEALTH
              </span>
            </div>
          </div>

          <div className="hidden items-center gap-4 text-xs text-slate-300 sm:flex">
            <span className="rounded-full bg-slate-900/60 px-3 py-1 backdrop-blur">
              Built for medical practices in Cyprus
            </span>
          </div>
        </header>

        {/* Hero + How it works */}
        <div className="mt-10 flex flex-1 flex-col gap-10 lg:mt-16 lg:flex-row lg:items-center">
          {/* Hero content */}
          <section className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.25em] text-emerald-200/80 backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Smart booking for modern care
            </div>

            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">
              Smart Medical Appointments
              <span className="block text-emerald-300/90">
                in Cyprus
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm text-slate-300 sm:text-base">
              DocCy gives your practice a calm, premium booking experience.
              Patients choose a time, you get a clean agenda and WhatsApp-ready
              contact details – built for medical practices across Cyprus.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/dr-nikos"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Book with Dr. Nikos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>

              <p className="text-xs text-slate-400 sm:text-[13px]">
                No apps to install. Patients confirm via WhatsApp in seconds.
              </p>
            </div>

            {/* Small pill stats */}
            <div className="mt-8 flex flex-wrap gap-3 text-[11px] text-slate-300">
              <span className="rounded-full bg-slate-900/60 px-3 py-1 backdrop-blur">
                Designed for mobile-first doctors
              </span>
              <span className="rounded-full bg-slate-900/40 px-3 py-1 backdrop-blur">
                Europe/Nicosia timezone aware
              </span>
            </div>
          </section>

          {/* Glassmorphism panel: How it works */}
          <section className="w-full max-w-md rounded-3xl border border-emerald-100/10 bg-slate-900/50 p-5 shadow-2xl shadow-slate-950/50 backdrop-blur-xl lg:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-slate-100 sm:text-base">
                How DocCy works
              </h2>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-200">
                3 simple steps
              </span>
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3.5">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                    1. Choose your doctor
                  </p>
                  <p className="mt-1 text-[13px] text-slate-400">
                    Patients land on a clean profile for{" "}
                    <span className="font-medium text-emerald-200">
                      Dr. Nikos
                    </span>{" "}
                    and instantly see real availability.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-3.5">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                    2. Pick a time
                  </p>
                  <p className="mt-1 text-[13px] text-slate-400">
                    DocCy shows only free, local-time slots so your agenda stays
                    structured and double-booking free.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3 rounded-2xl border border-slate-700/40 bg-slate-900/30 p-3.5">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                    3. Confirm via WhatsApp
                  </p>
                  <p className="mt-1 text-[13px] text-slate-400">
                    Every booking drops into your{" "}
                    <span className="font-medium text-emerald-200">
                      Doctor&apos;s Agenda
                    </span>{" "}
                    with a WhatsApp-ready phone number – so follow‑up is one tap
                    away.
                  </p>
                </div>
              </div>
            </div>

            {/* Small footer tag */}
            <div className="mt-5 border-t border-slate-800/80 pt-4">
              <p className="text-[11px] text-slate-500">
                DocCy is built for{" "}
                <span className="font-medium text-slate-200">
                  clinics and medical practices in Cyprus
                </span>{" "}
                that want a calm, premium way to manage appointments — without
                adding workload to the front desk.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
