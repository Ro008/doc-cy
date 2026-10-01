"use client";

import * as React from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SignOutOtherSessionsButton } from "@/components/auth/SignOutOtherSessionsButton";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_ROW_CLASS,
  SETTINGS_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import { changePasswordMessage } from "@/lib/settings-account";

/**
 * Account → "Sign-in & security" (user, 2026-10-01): who is signed in, a new password
 * by email (the forgot-password flow, unchanged), other devices and this device, as
 * rows like the rest of settings.
 */
export function AccountSecurityCard({ email }: { email: string }) {
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [passwordResult, setPasswordResult] = React.useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function sendPasswordLink() {
    setPasswordBusy(true);
    setPasswordResult(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => null);
      setPasswordResult(changePasswordMessage(res.status, body, email));
    } catch {
      setPasswordResult(changePasswordMessage(0, null, email));
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <section className={SETTINGS_CARD_CLASS} data-testid="settings-account-security">
      <h2 className={SETTINGS_EYEBROW_CLASS}>Sign-in &amp; security</h2>
      <div className="mt-4 divide-y divide-slate-800">
        <div className={SETTINGS_ROW_CLASS}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Signed in as</p>
            <p className="mt-0.5 truncate text-sm text-slate-300" data-testid="settings-account-email">
              {email}
            </p>
          </div>
        </div>

        <div className={SETTINGS_ROW_CLASS}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Password</p>
            <p className="mt-0.5 text-xs text-slate-400">We email you a link to set a new one.</p>
            {passwordResult ? (
              <p
                role="status"
                className={`mt-1.5 text-xs font-medium ${passwordResult.ok ? "text-clinical-300" : "text-red-300"}`}
              >
                {passwordResult.message}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void sendPasswordLink()}
            disabled={passwordBusy}
            className={SETTINGS_SECONDARY_BUTTON_CLASS}
          >
            {passwordBusy ? "Sending…" : "Change password"}
          </button>
        </div>

        <div className={SETTINGS_ROW_CLASS}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Other devices</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Signed in on another phone or computer? Sign it out and stay signed in here.
            </p>
          </div>
          <SignOutOtherSessionsButton className={SETTINGS_SECONDARY_BUTTON_CLASS} />
        </div>

        <div className={SETTINGS_ROW_CLASS}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">This device</p>
            <p className="mt-0.5 text-xs text-slate-400">Sign out of DocCy on this browser.</p>
          </div>
          <SignOutButton
            data-testid="settings-sign-out-button"
            className="shrink-0 justify-center rounded-xl border border-rose-400/40 bg-transparent !px-3.5 !py-2 !text-sm !font-semibold text-rose-200 hover:border-rose-300/70 hover:bg-rose-500/10"
          />
        </div>
      </div>
    </section>
  );
}
