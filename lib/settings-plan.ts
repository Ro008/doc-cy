import { format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import { computeTrialDaysRemaining } from "@/lib/trial-period";

/**
 * Plan & billing in settings (user, 2026-10-01): the professional's own terms.
 * - `professionals.pro_access_until`: online booking is free until then (approval +
 *   the trial months); after it, booking pauses and the public profile stays.
 * There are no payments yet ("no credit card required" to sign up), so the tab says
 * there is nothing to pay today: no payment form, no "coming soon" placeholder.
 * User, 2026-10-12: the countdown stays, and the note says plainly that online
 * booking is paid afterwards, so nobody takes it for free forever or feels charged
 * for something that was free. Free periods may be extended meanwhile.
 * The price is shown: these prices are firm, and a professional keeps the price from
 * when she registered; a later change is for new sign-ups only. Today that price
 * follows from `subscription_tier` (founder €19, everyone else €49). Nothing stores
 * a price per professional yet: BEFORE these prices change, the subscription work
 * must record each professional's own price, or this line would show the new one.
 * No tier badge on the tab.
 */

export const FOUNDER_PRICE = "€19/month";
export const FOUNDER_PRICE_TAG = "Founding Member price";
/** Shown beside every price (user, 2026-10-12). */
export const PRICE_VAT_NOTE = "+ VAT, if applicable";
export const STANDARD_PRICE = "€49/month";
export const ENDING_SOON_DAYS = 30;

export const PLAN_NOTE =
  "Nothing to pay today, and no card on file. After your free period, online booking continues at the price shown above. It is the price from when you registered, and it stays yours if DocCy’s prices change later. Nothing changes without notice: we’ll contact you well before your free period ends, with how to continue. Your public profile stays free either way.";

export const PLAN_NOTE_ENDED =
  "Nothing to pay today, and no card on file. Your public profile stays free either way.";

export type PlanState = "free" | "ending_soon" | "ended" | "none";

export type PlanSummary = {
  state: PlanState;
  /** e.g. "15 March 2027", on the Cyprus calendar. */
  endsOn: string | null;
  daysLeft: number | null;
  /** The price she registered with, hers to keep. */
  priceAfter: string;
  /** Why her price differs from the standard one, if it does. */
  priceTag: string | null;
};

export function planSummary(input: {
  proAccessUntil: string | Date | null | undefined;
  isFounder: boolean;
  now?: Date;
}): PlanSummary {
  const priceAfter = input.isFounder ? FOUNDER_PRICE : STANDARD_PRICE;
  const priceTag = input.isFounder ? FOUNDER_PRICE_TAG : null;
  const until = input.proAccessUntil ? new Date(input.proAccessUntil) : null;
  if (!until || !Number.isFinite(until.getTime())) {
    return { state: "none", endsOn: null, daysLeft: null, priceAfter, priceTag };
  }
  const daysLeft = Math.max(0, computeTrialDaysRemaining(until, input.now ?? new Date()));
  const state: PlanState = daysLeft <= 0 ? "ended" : daysLeft <= ENDING_SOON_DAYS ? "ending_soon" : "free";
  return {
    state,
    endsOn: format(utcToZonedTime(until, CY_TZ), "d MMMM yyyy"),
    daysLeft,
    priceAfter,
    priceTag,
  };
}
