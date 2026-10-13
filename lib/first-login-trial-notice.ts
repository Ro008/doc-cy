import type { SupabaseClient } from "@supabase/supabase-js";
import { isFounderSubscriptionTier } from "@/lib/subscription-tier";

export const FIRST_LOGIN_TRIAL_NOTICE_TEST_ID = "first-login-trial-notice";
export const TRIAL_NOTICE_DISMISS_PATH = "/api/doctor-settings/trial-notice";
/** A professional's first login lands here until the welcome notice is dismissed. */
export const DOCTOR_FIRST_LOGIN_PATH = "/settings";

export type FirstLoginTrialNoticeCopy = {
  title: string;
  intro: string;
  founderPrice: string | null;
  cta: string;
};

export function shouldShowFirstLoginTrialNotice(input: {
  trialNoticeSeenAt?: string | null;
}): boolean {
  return String(input.trialNoticeSeenAt ?? "").trim().length === 0;
}

/** Same signal as the welcome modal: not yet dismissed. */
export function shouldRedirectFirstLoginToSettings(input: {
  trialNoticeSeenAt?: string | null;
}): boolean {
  return shouldShowFirstLoginTrialNotice(input);
}

export function firstLoginTrialNoticeCopy(isFounder: boolean): FirstLoginTrialNoticeCopy {
  return {
    title: "Welcome to DocCy",
    intro:
      "Your first 6 months on DocCy are free. Use your agenda, take bookings, and see the impact on your practice before you pay.",
    founderPrice: isFounder
      ? "After that, your Founding Member rate stays locked at €19/month for life."
      : null,
    cta: "Got it",
  };
}

function isMissingTrialNoticeColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "")
    .toLowerCase()
    .includes("trial_notice_seen_at");
}

export async function loadFirstLoginTrialNoticeState(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ show: boolean; isFounder: boolean }> {
  const res = await supabase
    .from("professionals")
    .select("subscription_tier, trial_notice_seen_at")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (res.error) {
    if (isMissingTrialNoticeColumn(res.error)) {
      return { show: false, isFounder: false };
    }
    console.error("[DocCy] trial notice lookup failed", res.error);
    return { show: false, isFounder: false };
  }

  const row = res.data as {
    subscription_tier?: string | null;
    trial_notice_seen_at?: string | null;
  } | null;
  if (!row) return { show: false, isFounder: false };

  return {
    show: shouldShowFirstLoginTrialNotice({
      trialNoticeSeenAt: row.trial_notice_seen_at,
    }),
    isFounder: isFounderSubscriptionTier(row.subscription_tier),
  };
}
