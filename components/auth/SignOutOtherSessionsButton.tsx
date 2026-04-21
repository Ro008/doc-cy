"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export function SignOutOtherSessionsButton() {
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
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-slate-100">Device security</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Keep this session active on this device and close all other active sessions.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="mt-3 inline-flex items-center rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Closing sessions..." : "Sign out on other devices"}
      </button>
      {message ? <p className="mt-2 text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

