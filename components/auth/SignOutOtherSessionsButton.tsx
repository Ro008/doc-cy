"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { toast } from "sonner";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";

/** The button; the result is a toast. The caller places it (settings "Sign-in & security"). */
export function SignOutOtherSessionsButton({ className }: { className?: string }) {
  const supabase = createClientComponentClient();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const revokeResponse = await fetch("/api/auth/revoke-other-sessions", {
        method: "POST",
      });
      if (!revokeResponse.ok) {
        toast.error("Could not sign out other devices. Please try again.", { id: "sign-out-others" });
        console.error("[DocCy][auth] revoke_other_sessions_failed", {
          status: revokeResponse.status,
        });
        return;
      }

      // Best-effort Supabase refresh-token revocation for other sessions.
      const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
      if (signOutError) {
        console.warn("[DocCy][auth] signout_others_refresh_revoke_failed", signOutError);
      }

      toast.success("Other devices have been signed out.", { id: "sign-out-others" });
      console.info("[DocCy][auth] signout_others_success");
    } catch (err) {
      toast.error("Could not sign out other devices. Please try again.", { id: "sign-out-others" });
      console.error("[DocCy][auth] signout_others_failed_unexpected", err);
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} aria-busy={pending} className={className}>
      <BusyLabel busy={pending} busyText="Signing out…">
        Sign out other devices
      </BusyLabel>
    </button>
  );
}
