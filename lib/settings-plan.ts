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
 * User, 2026-10-12: no price and no tier here until the subscription work (Stripe,
 * the Founders' Club) is done, and free periods may be extended meanwhile. The
 * countdown stays, and the note says plainly that online booking is paid afterwards,
 * so nobody takes it for free forever or feels charged for something that was free.
 */

export const ENDING_SOON_DAYS = 30;

export const PLAN_NOTE =
  "Nothing to pay today, and no card on file. After your free period, online booking continues with a paid subscription. Nothing changes without notice: we’ll contact you well before it ends, with the price and how to continue. Your public profile stays free either way.";

export const PLAN_NOTE_ENDED =
  "Nothing to pay today, and no card on file. Your public profile stays free either way.";

export type PlanState = "free" | "ending_soon" | "ended" | "none";

export type PlanSummary = {
  state: PlanState;
  /** e.g. "15 March 2027", on the Cyprus calendar. */
  endsOn: string | null;
  daysLeft: number | null;
};

export function planSummary(input: {
  proAccessUntil: string | Date | null | undefined;
  now?: Date;
}): PlanSummary {
  const until = input.proAccessUntil ? new Date(input.proAccessUntil) : null;
  if (!until || !Number.isFinite(until.getTime())) {
    return { state: "none", endsOn: null, daysLeft: null };
  }
  const daysLeft = Math.max(0, computeTrialDaysRemaining(until, input.now ?? new Date()));
  const state: PlanState = daysLeft <= 0 ? "ended" : daysLeft <= ENDING_SOON_DAYS ? "ending_soon" : "free";
  return {
    state,
    endsOn: format(utcToZonedTime(until, CY_TZ), "d MMMM yyyy"),
    daysLeft,
  };
}
