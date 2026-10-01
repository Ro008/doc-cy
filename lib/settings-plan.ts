import { format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import { computeTrialDaysRemaining } from "@/lib/trial-period";

/**
 * Plan & billing in settings (user, 2026-10-01): the professional's own terms.
 * - `professionals.pro_access_until`: online booking is free until then (approval +
 *   the trial months); after it, booking pauses and the public profile stays.
 * - `subscription_tier = "founder"`: Founding Member, €19/month locked for life;
 *   everyone else moves to the standard €49/month (as /register says).
 * There are no payments yet ("no credit card required" to sign up), so the tab says
 * there is nothing to pay today and that subscribing opens here before the free
 * period ends: no payment form, no "coming soon" placeholder.
 */

export const FOUNDER_PRICE = "€19/month, locked for life";
export const STANDARD_PRICE = "€49/month";
export const ENDING_SOON_DAYS = 30;

export const NOTHING_TO_PAY_TODAY =
  "Nothing to pay today. No card on file. Before your free period ends, you’ll be able to subscribe here to keep online booking. Your profile stays free either way.";

export type PlanState = "free" | "ending_soon" | "ended" | "none";

export type PlanSummary = {
  tierLabel: "Founding Member" | "Standard";
  state: PlanState;
  /** e.g. "15 March 2027", on the Cyprus calendar. */
  endsOn: string | null;
  daysLeft: number | null;
  priceAfter: string;
};

export function planSummary(input: {
  proAccessUntil: string | Date | null | undefined;
  isFounder: boolean;
  now?: Date;
}): PlanSummary {
  const tierLabel = input.isFounder ? "Founding Member" : "Standard";
  const priceAfter = input.isFounder ? FOUNDER_PRICE : STANDARD_PRICE;
  const until = input.proAccessUntil ? new Date(input.proAccessUntil) : null;
  if (!until || !Number.isFinite(until.getTime())) {
    return { tierLabel, state: "none", endsOn: null, daysLeft: null, priceAfter };
  }
  const daysLeft = Math.max(0, computeTrialDaysRemaining(until, input.now ?? new Date()));
  const state: PlanState = daysLeft <= 0 ? "ended" : daysLeft <= ENDING_SOON_DAYS ? "ending_soon" : "free";
  return {
    tierLabel,
    state,
    endsOn: format(utcToZonedTime(until, CY_TZ), "d MMMM yyyy"),
    daysLeft,
    priceAfter,
  };
}
