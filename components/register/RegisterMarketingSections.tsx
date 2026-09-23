import { Plus } from "lucide-react";
import { RegisterDemoBookingButton } from "@/components/register/RegisterDemoBookingButton";
import { REGISTER_FAQ_ITEMS } from "@/lib/register-faq";
import type { RegisterPlanTicket as RegisterPlanTicketData } from "@/lib/register-plan-ticket";
import { registerSectionShell } from "@/lib/register-ui";

export const REGISTER_SETUP_CALL_ID = "register-setup-call";

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
    <header className="space-y-1.5">
      <h1 className="text-balance text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-900 sm:text-[32px]">
        {greeting ?? (
          <>
            Join DocCy in{" "}
            <span className="whitespace-nowrap rounded-lg bg-clinical-200 px-1.5 sm:px-2">
              3 steps
            </span>
          </>
        )}
      </h1>
      <p className="text-[15px] leading-relaxed text-ink-600">
        {claim
          ? "Confirm your details to activate this listing. We verify your licence within 24 hours."
          : "About 4 minutes. We verify your licence within 24 hours, then you go live."}
      </p>
    </header>
  );
}

/**
 * Free profile · 6 free months · then Founders (or standard) pricing.
 * `row` = three cells side by side (desktop showcase); `stacked` = phones.
 */
export function RegisterPlanTicket({
  ticket,
  layout,
  className = "",
}: {
  ticket: RegisterPlanTicketData;
  layout: "row" | "stacked";
  className?: string;
}) {
  const kicker = "text-[10px] font-extrabold tracking-[0.12em] sm:text-[11px] sm:tracking-[0.14em]";
  // The desktop row shares ~660px across three cells, so it runs a notch smaller.
  const price = `text-xl font-extrabold ${layout === "row" ? "sm:text-[22px]" : "sm:text-2xl"}`;
  const cellPadding = layout === "row" ? "px-3.5 py-3.5 sm:px-4 sm:py-4" : "px-3.5 py-3.5 sm:px-5 sm:py-[18px]";
  const freeCells = [ticket.profile, ticket.booking].map((cell, index) => (
    <div
      key={cell.kicker}
      className={`flex flex-col gap-0.5 bg-white sm:gap-1 ${cellPadding} ${
        index === 0 || layout === "row" ? "border-r-2 border-dashed border-clinical-200" : ""
      }`}
    >
      <span className={`${kicker} text-clinical-800`}>{cell.kicker}</span>
      <span className={`${price} text-ink-900`}>{cell.price}</span>
      <span className="text-xs text-ink-600 sm:text-[13px]">{cell.detail}</span>
    </div>
  ));
  const { then } = ticket;
  const thenCell = (
    <div className={`flex flex-col gap-1 bg-ink-900 text-white ${cellPadding}`}>
      <span className={`${kicker} text-clinical-400`}>{then.kicker}</span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={price}>{then.price}</span>
        {then.wasPrice ? (
          <span className="text-[13px] text-ink-300">
            instead of <s>{then.wasPrice}</s>
          </span>
        ) : null}
      </span>
      <span className="text-xs text-ink-200 sm:text-[13px]">{then.detail}</span>
      {then.spots && then.spotsTakenPercent !== null ? (
        <div className="mt-1 flex items-center gap-2.5">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={then.spotsTakenPercent}
            aria-label="Founding Member spots taken"
          >
            <div
              className="h-full rounded-full bg-clinical-400"
              style={{ width: `${then.spotsTakenPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-bold text-clinical-400 sm:text-[13px]">
            {then.spots}
          </span>
        </div>
      ) : null}
      <span className="text-[10px] leading-snug text-ink-300">{then.vatNote}</span>
    </div>
  );

  return (
    <div
      data-testid={`register-plan-ticket-${layout}`}
      className={`overflow-hidden rounded-[18px] border border-clinical-200 shadow-[0_8px_24px_rgba(6,47,97,0.14)] sm:rounded-[20px] ${className}`}
    >
      {layout === "row" ? (
        <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,1.55fr)]">
          {freeCells}
          {thenCell}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2">{freeCells}</div>
          {thenCell}
        </>
      )}
    </div>
  );
}

const NEXT_STEPS = [
  {
    when: "Right away",
    title: "Confirm your email",
    body: "One click on the link we send. Not a code.",
  },
  {
    when: "Within 24 hours",
    title: "We verify your licence",
    body: "Our team checks your registration number to keep the platform trusted.",
  },
  {
    when: "You're live",
    title: "Set your hours, start booking",
    body: "Configure hours, appointment types and your profile from your dashboard.",
  },
] as const;

export function RegisterNextSteps() {
  return (
    <section
      aria-labelledby="register-next-steps-heading"
      className="mx-4 mt-4 rounded-[26px] bg-ink-900 px-5 py-7 sm:mx-6 sm:mt-10 sm:rounded-[32px] sm:px-10 sm:py-14 lg:px-24"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2
          id="register-next-steps-heading"
          className="text-2xl font-extrabold tracking-tight text-white sm:text-[32px]"
        >
          What happens after you apply
        </h2>
        <p className="text-[15px] text-ink-300">From application to live profile in about a day</p>
      </div>
      <ol className="mt-5 grid gap-3.5 sm:mt-8 md:grid-cols-3 md:gap-4">
        {NEXT_STEPS.map((item, index) => {
          const last = index === NEXT_STEPS.length - 1;
          return (
            <li
              key={item.title}
              className={`flex gap-3.5 rounded-2xl p-4 md:flex-col md:gap-3 md:rounded-[20px] md:p-6 ${
                last ? "bg-clinical-500" : "bg-ink-800"
              }`}
            >
              <span
                aria-hidden
                className={`inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-extrabold md:h-10 md:w-10 ${
                  last
                    ? "bg-ink-900 text-white"
                    : index === 0
                      ? "bg-clinical-500 text-ink-900"
                      : "bg-clinical-400 text-ink-900"
                }`}
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-1 md:gap-2">
                <span
                  className={`text-xs font-bold md:text-[13px] ${last ? "text-ink-900" : "text-clinical-400"}`}
                >
                  {item.when}
                </span>
                <span
                  className={`text-base font-extrabold md:text-[19px] ${last ? "text-ink-900" : "text-white"}`}
                >
                  {item.title}
                </span>
                <span
                  className={`text-sm leading-relaxed md:text-[15px] ${last ? "text-ink-900" : "text-ink-200"}`}
                >
                  {item.body}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function RegisterFaqSection() {
  return (
    <section data-testid="register-faq" aria-labelledby="register-faq-heading" className="min-w-0 flex-1">
      <h2
        id="register-faq-heading"
        className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-[32px]"
      >
        Frequently asked questions
      </h2>
      <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-2.5">
        {REGISTER_FAQ_ITEMS.map((item) => (
          <details
            key={item.question}
            className="group rounded-[14px] border-[1.5px] border-ink-100 bg-white transition open:border-clinical-500 open:bg-clinical-100 sm:rounded-[18px]"
          >
            <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-left text-[15px] font-bold text-ink-900 sm:min-h-[64px] sm:px-[22px] sm:text-[17px] [&::-webkit-details-marker]:hidden [&::marker]:content-none">
              {item.question}
              <span
                aria-hidden
                className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-clinical-500 text-ink-900 transition group-open:rotate-45 group-open:bg-ink-900 group-open:text-white sm:h-[34px] sm:w-[34px]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} />
              </span>
            </summary>
            <p className="px-4 pb-4 text-sm leading-relaxed text-ink-700 sm:px-[22px] sm:pb-[22px] sm:pr-20 sm:text-[15px]">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function RegisterSetupCallCard() {
  return (
    <aside
      id={REGISTER_SETUP_CALL_ID}
      aria-labelledby="register-setup-call-heading"
      className="relative flex scroll-mt-6 flex-col gap-3 overflow-hidden rounded-3xl bg-clinical-500 p-6 text-ink-900 sm:p-[30px] lg:w-[360px] lg:shrink-0"
    >
      <span
        aria-hidden
        className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-clinical-400 sm:-right-16 sm:-top-16 sm:h-48 sm:w-48"
      />
      <span className="relative text-[11px] font-extrabold tracking-[0.16em] sm:text-xs">
        RATHER TALK?
      </span>
      <h2
        id="register-setup-call-heading"
        className="relative text-[21px] font-extrabold leading-tight sm:text-2xl"
      >
        We&apos;ll set you up on a 15-minute call.
      </h2>
      <p className="relative text-sm leading-relaxed sm:text-[15px]">
        We register you and walk you through the site. Free, no commitment.
      </p>
      <RegisterDemoBookingButton className="relative mt-1 inline-flex min-h-[50px] w-full items-center justify-center rounded-xl bg-ink-900 px-5 text-[15px] font-extrabold text-white transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-clinical-500">
        Book a setup call
      </RegisterDemoBookingButton>
    </aside>
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
