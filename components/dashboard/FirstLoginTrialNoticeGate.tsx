import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { FirstLoginTrialNotice } from "@/components/dashboard/FirstLoginTrialNotice";
import { loadFirstLoginTrialNoticeState } from "@/lib/first-login-trial-notice";

export async function FirstLoginTrialNoticeGate() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { show, isFounder } = await loadFirstLoginTrialNoticeState(supabase, user.id);
  if (!show) return null;

  return <FirstLoginTrialNotice isFounder={isFounder} />;
}
