"use client";

import * as React from "react";
import { CalendarClock, Check } from "lucide-react";
import { FoundingMemberBadge } from "@/components/dashboard/FoundingMemberBadge";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import { emitOpenFeedback } from "@/lib/doccy-feedback";
import { NOTHING_TO_PAY_TODAY, type PlanSummary } from "@/lib/settings-plan";

/**
 * Settings → Plan & billing (user, 2026-10-01): the free period with its countdown,
 * the terms that follow, and that there is nothing to pay today. Read-only: there
 * are no payments yet.
 */
export function PlanBillingSection({ plan, isFounder }: { plan: PlanSummary; isFounder: boolean }) {
  const ended = plan.state === "ended";
  const endingSoon = plan.state === "ending_soon";

  const terms: Array<[string, string]> = [
    ["Public profile", "Free, forever"],
    [
      "Online booking",
      plan.endsOn ? (ended ? `Free period ended on ${plan.endsOn}` : `Free until ${plan.endsOn}`) : "Free during your trial",
    ],
    ["After your free period", plan.priceAfter],
  ];

  return (
    <div className="space-y-5">
      <section
        className={`${SETTINGS_CARD_CLASS} ${ended || endingSoon ? "!border-amber-400/40" : ""}`}
        data-testid="settings-plan-status"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={SETTINGS_EYEBROW_CLASS}>Your plan</h2>
          {isFounder ? <FoundingMemberBadge href={null} /> : (
            <span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200">
              {plan.tierLabel}
            </span>
          )}
        </div>

        {plan.state === "none" ? (
          <p className="mt-4 text-sm text-slate-300">
            Online booking starts once your profile is verified. Your public profile is free either way.
          </p>
        ) : ended ? (
          <div className="mt-4">
            <p className="text-xl font-semibold text-amber-100">Your free period ended on {plan.endsOn}.</p>
            <p className="mt-1.5 text-sm text-slate-300">
              Online booking is paused. Your profile stays live and patients can still call you.
            </p>
            <button
              type="button"
              data-testid="settings-plan-contact"
              onClick={() =>
                emitOpenFeedback({
                  subject: "General Question",
                  message: "Hello, my free period has ended and I would like to keep online booking.",
                })
              }
              className={`mt-4 ${SETTINGS_SECONDARY_BUTTON_CLASS}`}
            >
              Contact us to keep online booking
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p
                className={`text-4xl font-semibold tabular-nums tracking-tight ${endingSoon ? "text-amber-100" : "text-slate-50"}`}
                data-testid="settings-plan-days-left"
              >
                {plan.daysLeft} {plan.daysLeft === 1 ? "day" : "days"}
              </p>
              <p className="mt-1 text-sm text-slate-400">of free online booking left</p>
            </div>
            <p className="inline-flex items-center gap-2 text-sm text-slate-300">
              <CalendarClock className="h-4 w-4 text-clinical-300" aria-hidden />
              Free until {plan.endsOn}
            </p>
          </div>
        )}
      </section>

      <section className={SETTINGS_CARD_CLASS} data-testid="settings-plan-terms">
        <h2 className={SETTINGS_EYEBROW_CLASS}>Your terms</h2>
        <dl className="mt-3 divide-y divide-slate-800">
          {terms.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-sm text-slate-400">{label}</dt>
              <dd className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Check className="h-4 w-4 text-clinical-300" aria-hidden />
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {isFounder ? (
          // The Founding Member's direct line (was the badge pop-up's "Contact Founding Team").
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-100">A direct line to the founders</p>
              <p className="mt-0.5 text-xs text-slate-400">Your feedback shapes what DocCy builds next.</p>
            </div>
            <button
              type="button"
              data-testid="settings-plan-write-founders"
              onClick={() => emitOpenFeedback({ subject: "Founding Member Inquiry" })}
              className={SETTINGS_SECONDARY_BUTTON_CLASS}
            >
              Write to the founders
            </button>
          </div>
        ) : null}
      </section>

      <section className={SETTINGS_CARD_CLASS} data-testid="settings-plan-payment">
        <h2 className={SETTINGS_EYEBROW_CLASS}>Payment</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{NOTHING_TO_PAY_TODAY}</p>
      </section>
    </div>
  );
}
