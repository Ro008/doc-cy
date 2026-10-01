"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/** The button and its result line; the caller places it (settings "Sign-in & security"). */
export function SignOutOtherSessionsButton({ className }: { className?: string }) {
  const supabase = createClientComponentClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const revokeResponse = await fetch("/api/auth/revoke-other-sessions", {
        method: "POST",
      });
      if (!revokeResponse.ok) {
        setError("Could not sign out other devices. Please try again.");
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

      setMessage("Other devices have been signed out.");
      console.info("[DocCy][auth] signout_others_success");
    } catch (err) {
      setError("Could not sign out other devices. Please try again.");
      console.error("[DocCy][auth] signout_others_failed_unexpected", err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button type="button" onClick={handleClick} disabled={pending} className={className}>
        {pending ? "Signing out other devices…" : "Sign out other devices"}
      </button>
      {message ? <p className="text-xs text-clinical-300">{message}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
