import { CalendarCheck, ChevronDown, Globe } from "lucide-react";
import { RegisterDemoBookingButton } from "@/components/register/RegisterDemoBookingButton";
import { registerSectionShell } from "@/lib/register-ui";

function RegisterValueOffer() {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      <li className="relative overflow-hidden rounded-2xl border border-clinical-200/90 bg-gradient-to-br from-clinical-50 via-white to-white px-4 py-3.5 shadow-[0_1px_3px_rgba(26,43,60,0.05)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clinical-500 text-white shadow-[0_4px_12px_rgba(18,184,192,0.35)]">
            <Globe className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clinical-700">
              Public profile
            </p>
            <p className="mt-0.5 text-base font-semibold tracking-tight text-ink-900">
              Free, forever
            </p>
            <p className="mt-1 text-sm leading-snug text-ink-600">
              Your listing stays visible to patients on DocCy. No listing fee, ever.
            </p>
          </div>
        </div>
      </li>
      <li className="relative overflow-hidden rounded-2xl border border-wellness-200/90 bg-gradient-to-br from-wellness-50 via-white to-white px-4 py-3.5 shadow-[0_1px_3px_rgba(26,43,60,0.05)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wellness-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.28)]">
            <CalendarCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-wellness-800">
              Online booking
            </p>
            <p className="mt-0.5 text-base font-semibold tracking-tight text-ink-900">
              Free for 6 months
            </p>
            <p className="mt-1 text-sm leading-snug text-ink-600">
              Then Founding Members lock €19/month.
            </p>
          </div>
        </div>
      </li>
    </ul>
  );
}

const trialPoints = [
  {
    title: "Profile listed for free",
    detail: "Patients can find you on DocCy forever. No listing fee, ever.",
  },
  {
    title: "6 months of online booking",
    detail: "Agenda, requests, and 1-click approval — free for the first 6 months.",
  },
  {
    title: "€19/month lock",
    detail: "After that, Founding Members keep online booking at €19/month for life.",
  },
  {
    title: "Zero setup fees",
    detail: "No credit card to sign up, and you can cancel anytime.",
  },
] as const;

const faqItems = [
  {
    question: "Is the 6-month trial really free?",
    answer:
      "Your public profile is free forever — patients can find you with no listing fee. Online booking (agenda and 1-click approval) is free for 6 full months, with no credit card to sign up. After that, Founding Members keep booking at €19/month.",
  },
  {
    question: "What happens after my application is submitted?",
    answer:
      "Our team securely reviews your professional certification or registration number to maintain the high standards of our platform. First, confirm your email with the one-click link we send after you apply. Once your credentials are verified (usually within 24 hours), your profile becomes live, and you will receive access to your Digital Command Center.",
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

const summaryClass =
  "flex cursor-pointer list-none items-start justify-between gap-3 text-left [&::-webkit-details-marker]:hidden [&::marker]:content-none";

const disclosureClass =
  "group rounded-2xl border border-ink-200/90 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(26,43,60,0.04)]";

function DisclosureChevron() {
  return (
    <ChevronDown
      className="mt-0.5 h-4 w-4 shrink-0 text-ink-400 transition group-open:rotate-180"
      aria-hidden
    />
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
    <header className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink-900 sm:text-[2rem]">
          {greeting ?? "List your practice on DocCy."}
        </h1>
        <div
          className="h-1 w-14 rounded-full bg-gradient-to-r from-clinical-500 to-wellness-500"
          aria-hidden
        />
      </div>
      <RegisterValueOffer />
      <p className="text-sm text-ink-500">
        Apply now · We verify within 24 hours · Go live
      </p>
    </header>
  );
}

export function RegisterOnboardingCallDetails() {
  return (
    <details id="register-onboarding-call" className={disclosureClass}>
      <summary
        data-testid="register-onboarding-call-toggle"
        className={summaryClass}
      >
        <span className="text-sm font-semibold text-ink-800">
          Prefer we set you up on a call?
        </span>
        <DisclosureChevron />
      </summary>
      <div className="mt-3 space-y-3 border-t border-ink-100 pt-3 text-sm leading-relaxed text-ink-600">
        <p>
          On a short call we register you, walk through the site, and sync your calendar. Free, no
          commitment, about 15 minutes.
        </p>
        <RegisterDemoBookingButton />
      </div>
    </details>
  );
}

export function RegisterTrialDetails() {
  return (
    <details className={disclosureClass}>
      <summary className={summaryClass}>
        <span className="text-sm font-semibold text-ink-800">Trial, pricing, and guarantees</span>
        <DisclosureChevron />
      </summary>
      <ul className="mt-3 space-y-2.5 border-t border-ink-100 pt-3">
        {trialPoints.map((item) => (
          <li key={item.title} className="text-sm leading-relaxed text-ink-600">
            <span className="font-semibold text-ink-800">{item.title}.</span> {item.detail}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function RegisterFaqSection() {
  return (
    <section>
      <h2 className="text-sm font-semibold tracking-tight text-ink-800">Questions</h2>
      <div className="mt-2 space-y-2">
        {faqItems.map((item) => (
          <details key={item.question} className={disclosureClass}>
            <summary className={summaryClass}>
              <span className="text-sm font-medium leading-snug text-ink-800">{item.question}</span>
              <DisclosureChevron />
            </summary>
            <p className="mt-3 border-t border-ink-100 pt-3 text-sm leading-relaxed text-ink-600">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function RegisterSecondarySections() {
  return (
    <div className="space-y-2">
      <RegisterOnboardingCallDetails />
      <RegisterTrialDetails />
      <div className="pt-4">
        <RegisterFaqSection />
      </div>
    </div>
  );
}

export function RegisterSubmittedPanel({
  claimed = false,
  emailConfirmed = false,
  confirmError = false,
}: {
  claimed?: boolean;
  emailConfirmed?: boolean;
  confirmError?: boolean;
}) {
  return (
    <div className={`${registerSectionShell} space-y-4 text-sm text-ink-700`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-clinical-300 bg-clinical-50 px-3 py-1 text-[11px] font-medium tracking-[0.25em] text-clinical-700">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-clinical-500" />
        {emailConfirmed ? "EMAIL CONFIRMED" : "APPLICATION RECEIVED"}
      </div>
      <h2 className="text-lg font-semibold text-ink-900 sm:text-xl">
        {emailConfirmed
          ? claimed
            ? "Thank you — your listing is under review"
            : "Thank you — your profile is under review"
          : "Thank you — confirm your email to continue"}
      </h2>
      {confirmError ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          That confirmation link is invalid or has expired. Open the newest email we sent, or
          register again if you never received one.
        </p>
      ) : null}
      {emailConfirmed ? (
        <>
          <p>
            {claimed ? (
              <>
                This is the same profile patients already find on DocCy. Our team will verify your
                credentials and then turn on online booking, usually within{" "}
                <span className="font-medium text-clinical-700">24 hours</span>.
              </>
            ) : (
              <>
                Our team will verify your professional credentials and activate your DocCy profile
                within <span className="font-medium text-clinical-700">24 hours</span>.
              </>
            )}
          </p>
          <p>
            Once approved, we&apos;ll email you a link to sign in and open your dashboard, where you
            can configure working hours, appointment types, and your public profile.
          </p>
        </>
      ) : (
        <>
          <p>
            We sent a confirmation link to your email. Open it to confirm this address — one click,
            not a code.
          </p>
          <p>
            After that, our team reviews your credentials, usually within{" "}
            <span className="font-medium text-clinical-700">24 hours</span>. You will get another
            email when you can sign in.
          </p>
        </>
      )}
    </div>
  );
}
