import { ArrowRight, ChevronDown } from "lucide-react";
import { RegisterDemoBookingButton } from "@/components/register/RegisterDemoBookingButton";
import { registerSectionShell } from "@/lib/register-ui";

const roadmapSteps = [
  {
    step: "STEP 1",
    title: "Fill the form",
    detail: "Takes 2 minutes",
  },
  {
    step: "STEP 2",
    title: "Quick Verification",
    detail: "100% secure check",
  },
  {
    step: "STEP 3",
    title: "Go Live & Sync",
    detail: "6 Months Free",
  },
] as const;

const trustBadges = [
  {
    title: "6 Months Free",
    detail: "100% risk-free testing to prove performance.",
  },
  {
    title: "€19/Month Lock",
    detail: "Locked for life for the first 50 practices.",
  },
  {
    title: "Zero Setup Fees",
    detail: "No credit card required to sign up.",
  },
  {
    title: "Cancel Anytime",
    detail: "No strings attached, no hidden contracts.",
  },
] as const;

const faqItems = [
  {
    question: "Is the 6-month trial really free?",
    answer:
      "Yes, completely. No credit card is required to sign up, and there are no hidden setup fees. You get 6 full months of unrestricted access to experience the platform, capture real patients, and see the reduction in phone chaos before you ever spend a single cent.",
  },
  {
    question: "What happens after my application is submitted?",
    answer:
      "Our team securely reviews your professional certification or registration number to maintain the high standards of our platform. Once verified (usually within 24 hours), your profile becomes live, and you will receive access to your Digital Command Center.",
  },
  {
    question: "I am already using a paper diary or another tool. Is it hard to switch?",
    answer:
      "Less than 5 minutes. DocCy is built to be intuitive and plug-and-play. Prefer a hands-off start? Contact us and we'll set you up on a call: we activate your account, walk you through the site, and handle the calendar transition for you.",
  },
  {
    question: "How does the 1-click approval protect my agenda?",
    answer:
      "Unlike other directories that allow blind, unvetted bookings, DocCy gives you a digital shield. Every request arrives structured with the patient's name, requested time, and reason for consultation. Nothing enters your calendar without your explicit approval.",
  },
] as const;

export function RegisterPromoBanner() {
  return (
    <div className="rounded-2xl border border-wellness-200 bg-gradient-to-r from-wellness-50 via-white to-clinical-50 px-4 py-3.5 shadow-[0_1px_3px_rgba(26,43,60,0.05)] sm:px-5">
      <p className="text-sm font-medium leading-relaxed text-ink-800 sm:text-base">
        <span className="mr-1.5" aria-hidden>
          ⚡
        </span>
        <span className="font-semibold text-ink-900">Launch Promo:</span> Get your first 6 months
        completely FREE. Secure your lifetime Founding Member rate (€19/mo).
      </p>
    </div>
  );
}

export function RegisterIntroSection({
  claim,
}: {
  claim?: { firstName: string | null } | null;
} = {}) {
  const greeting = claim?.firstName
    ? `We were waiting for you, ${claim.firstName}.`
    : claim
      ? "We were waiting for you."
      : null;

  return (
    <header className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          {greeting ?? "List your practice on DocCy."}
        </h1>
        {claim ? null : (
          <p className="max-w-3xl text-base leading-relaxed text-ink-600 sm:text-lg">
            Join Cyprus&apos;s modern healthcare network and eliminate phone chaos with smart,
            1-click scheduling.
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {roadmapSteps.map((item, index) => (
          <li key={item.step} className="contents">
            <div className="flex-1 rounded-2xl border border-clinical-200 bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(26,43,60,0.05)]">
              <p className="text-[10px] font-bold tracking-[0.18em] text-clinical-600">
                {item.step}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-900">{item.title}</p>
              <p className="mt-0.5 text-xs text-ink-500">{item.detail}</p>
            </div>
            {index < roadmapSteps.length - 1 ? (
              <div
                className="flex shrink-0 items-center justify-center py-0.5 sm:px-1 sm:py-0"
                aria-hidden
              >
                <ArrowRight className="h-4 w-4 rotate-90 text-clinical-400 sm:rotate-0" />
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="rounded-xl border border-ink-200/80 bg-ink-50/90 px-3.5 py-2.5 text-sm text-ink-600">
        <span className="mr-1" aria-hidden>
          💡
        </span>
        Prefer a hands-off start?{" "}
        <a
          href="#register-onboarding-call"
          className="font-semibold text-clinical-600 underline decoration-clinical-300 underline-offset-2 hover:text-clinical-500"
        >
          Scroll down to request a free onboarding call
        </a>
        .
      </p>
    </header>
  );
}

export function RegisterDemoAside() {
  return (
    <aside
      id="register-onboarding-call"
      className="scroll-mt-8 rounded-3xl border border-clinical-300/60 bg-gradient-to-b from-clinical-50/90 to-white p-5 shadow-[0_8px_28px_rgba(18,184,192,0.12)] sm:p-6 lg:sticky lg:top-8"
    >
      <p className="text-lg font-semibold leading-snug text-ink-900">
        <span className="mr-1" aria-hidden>
          🏥
        </span>
        Not a fan of online forms? Let us do the setup for you.
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-clinical-800">
        We&apos;ll set you up on a call
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        Want us to activate your account for you? Get in touch — on a short call we&apos;ll
        register you and walk you through the site.
      </p>
      <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-700">
        <li>
          <span className="font-semibold text-ink-900">100% Free &amp; No Commitment:</span> We show
          you exactly how DocCy shields your practice from phone chaos.
        </li>
        <li>
          <span className="font-semibold text-ink-900">Done-For-You Setup:</span> We&apos;ll sync
          your current calendar and configure your availability during the call.
        </li>
        <li>
          <span className="font-semibold text-ink-900">Takes only 15 minutes:</span> Zero tech
          skills required on your end.
        </li>
      </ul>
      <div className="mt-5">
        <RegisterDemoBookingButton />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        Add your phone number in the message if you prefer a call to schedule, or leave your email
        for a written reply.
      </p>
    </aside>
  );
}

export function RegisterTrustBadges() {
  return (
    <section className={registerSectionShell}>
      <h2 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
        Why medical professionals in Cyprus choose DocCy
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {trustBadges.map((badge) => (
          <div
            key={badge.title}
            className="rounded-2xl border border-ink-200 bg-ink-50/80 px-4 py-3.5"
          >
            <p className="text-sm font-semibold text-clinical-700">{badge.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-600">{badge.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RegisterFaqSection() {
  return (
    <section className={registerSectionShell}>
      <h2 className="text-2xl font-semibold tracking-tight text-ink-900">Registration FAQ</h2>
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
            <p className="mt-3 text-sm leading-relaxed text-ink-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function RegisterSubmittedPanel({ claimed = false }: { claimed?: boolean }) {
  return (
    <div className={`${registerSectionShell} space-y-4 text-sm text-ink-700`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-clinical-300 bg-clinical-50 px-3 py-1 text-[11px] font-medium tracking-[0.25em] text-clinical-700">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-clinical-500" />
        APPLICATION RECEIVED
      </div>
      <h2 className="text-lg font-semibold text-ink-900 sm:text-xl">
        {claimed
          ? "Thank you — your listing is under review"
          : "Thank you — your profile is under review"}
      </h2>
      <p>
        {claimed ? (
          <>
            This is the same profile patients already find on DocCy. Our team will verify your
            credentials and then turn on online booking, usually within{" "}
            <span className="font-medium text-clinical-700">24 hours</span>.
          </>
        ) : (
          <>
            Our team will verify your professional credentials and activate your DocCy profile within{" "}
            <span className="font-medium text-clinical-700">24 hours</span>.
          </>
        )}
      </p>
      <p>
        Once approved, we&apos;ll email you a link to sign in and open your dashboard, where you can
        configure working hours, appointment types, and your public profile.
      </p>
    </div>
  );
}
