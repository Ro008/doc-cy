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
import { changeEmailMessage, changePasswordMessage, validateNewEmail } from "@/lib/settings-account";

/**
 * Account → "Sign-in & security" (user, 2026-10-01): who is signed in, a new password
 * by email (the forgot-password flow, unchanged), other devices and this device, as
 * rows like the rest of settings. "Change email" (2026-10-09) asks for the new address
 * and waits for the doctor to confirm it from a link; EXPECTED TO FAIL until Livio
 * builds POST /api/account/email (lib/settings-account.ts).
 */
export function AccountSecurityCard({ email }: { email: string }) {
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [passwordResult, setPasswordResult] = React.useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const [emailOpen, setEmailOpen] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [emailBusy, setEmailBusy] = React.useState(false);
  const [emailResult, setEmailResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);

  function closeEmailForm() {
    setEmailOpen(false);
    setNewEmail("");
    setEmailResult(null);
  }

  // Not a <form>: this card renders inside the settings form.
  async function requestEmailChange() {
    const invalid = validateNewEmail(email, newEmail);
    if (invalid) {
      setEmailResult({ ok: false, message: invalid });
      return;
    }
    const next = newEmail.trim();
    setEmailBusy(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: next }),
      });
      const body = await res.json().catch(() => null);
      const result = changeEmailMessage(res.status, body, next);
      if (result.ok) {
        setPendingEmail(next);
        setEmailOpen(false);
        setNewEmail("");
      }
      setEmailResult(result);
    } catch {
      setEmailResult(changeEmailMessage(0, null, next));
    } finally {
      setEmailBusy(false);
    }
  }

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
        <div className="py-4 first:pt-0" data-testid="settings-account-email-row">
          <div className={`${SETTINGS_ROW_CLASS} !py-0`}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">Email</p>
              <p className="mt-0.5 truncate text-sm text-slate-300" data-testid="settings-account-email">
                {email}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">You sign in with it.</p>
              {pendingEmail ? (
                <p className="mt-1.5 text-xs font-medium text-amber-200" data-testid="settings-account-email-pending">
                  Waiting for you to confirm {pendingEmail}.
                </p>
              ) : null}
            </div>
            {emailOpen ? null : (
              <button
                type="button"
                onClick={() => {
                  setEmailResult(null);
                  setEmailOpen(true);
                }}
                className={SETTINGS_SECONDARY_BUTTON_CLASS}
              >
                Change email
              </button>
            )}
          </div>
          {emailOpen ? (
            <div className="mt-3">
              <label htmlFor="settings-new-email" className="text-xs font-medium text-slate-300">
                New email
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id="settings-new-email"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    void requestEmailChange();
                  }}
                  aria-invalid={emailResult?.ok === false}
                  aria-describedby="settings-new-email-help"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void requestEmailChange()}
                    disabled={emailBusy}
                    className="inline-flex h-10 items-center rounded-xl bg-clinical-500 px-3.5 text-sm font-semibold text-ink-900 transition hover:bg-clinical-400 disabled:opacity-60"
                  >
                    {emailBusy ? "Sending…" : "Send confirmation link"}
                  </button>
                  <button
                    type="button"
                    onClick={closeEmailForm}
                    className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-slate-300 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <p id="settings-new-email-help" className="mt-1.5 text-xs text-slate-400">
                We send a link to the new address. Nothing changes until you open it.
              </p>
            </div>
          ) : null}
          {emailResult ? (
            <p
              role="status"
              data-testid="settings-account-email-result"
              className={`mt-1.5 text-xs font-medium ${emailResult.ok ? "text-clinical-300" : "text-red-300"}`}
            >
              {emailResult.message}
            </p>
          ) : null}
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
