"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  adminSignInStep,
  parseAuthHash,
  safeInternalNextPath,
  ADMIN_SIGN_IN_PATH,
  type AdminSignInStep,
} from "@/lib/admin-sign-in-flow";
import type { AdminAccessDenial } from "@/lib/admin-auth-core";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR,
  PASSWORD_POLICY_HELPER,
  isStrongPassword,
} from "@/lib/password-policy";

type Step = AdminSignInStep["step"] | "loading";

type Enrolment = { factorId: string; qrCode: string; secret: string };

/**
 * user_metadata flag: the invited admin has chosen a password. Only steers which
 * step to show (a user can edit their own metadata); access is decided server-side.
 */
const ADMIN_PASSWORD_SET_FLAG = "doccy_admin_password_set";

const DENIED_COPY: Record<"not_admin" | "inactive" | "professional_account", string> = {
  not_admin: "This account isn't a DocCy admin.",
  inactive: "This admin account has been deactivated. Ask a founder if you need access again.",
  professional_account:
    "You're signed in with a professional account. Admins use a separate login: sign out, then sign in with your admin email.",
};

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-500/40";
const buttonClass =
  "w-full rounded-xl bg-clinical-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-clinical-400 disabled:opacity-50";
const labelClass = "block text-xs font-medium text-slate-300";

export function AdminSignIn() {
  const searchParams = useSearchParams();
  const supabase = React.useMemo(() => createClientComponentClient(), []);
  const nextPath = safeInternalNextPath(searchParams.get("next"));

  const [step, setStep] = React.useState<Step>("loading");
  const [deniedReason, setDeniedReason] = React.useState<keyof typeof DENIED_COPY | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [enrolment, setEnrolment] = React.useState<Enrolment | null>(null);
  const mustSetPassword = React.useRef(false);

  const signOutLocally = React.useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    await fetch("/api/internal/logout", { method: "POST", credentials: "same-origin" }).catch(
      () => undefined,
    );
  }, [supabase]);

  const verifiedTotpFactorId = React.useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = (data?.all ?? []).find((f) => f.factor_type === "totp" && f.status === "verified");
    return factor?.id ?? null;
  }, [supabase]);

  const startEnrolment = React.useCallback(async () => {
    // Remove unfinished enrolments (e.g. a closed tab) so the new one can take the name.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const factor of factors?.all ?? []) {
      if (factor.factor_type === "totp" && factor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const { data, error: enrolError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "DocCy admin",
      issuer: "DocCy",
    });
    if (enrolError || !data) {
      setError(enrolError?.message ?? "Couldn't start the authenticator setup.");
      setStep("error");
      return;
    }
    setEnrolment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
    setStep("enrol_totp");
  }, [supabase]);

  /** Asks the server what this session may do, then shows the matching step. */
  const advance = React.useCallback(async () => {
    const res = await fetch("/api/internal/session", { cache: "no-store", credentials: "same-origin" });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: AdminAccessDenial };
    const access = res.ok && body.ok ? ("ok" as const) : (body.reason ?? "unavailable");
    const needsFactorInfo = access === "mfa_required" || access === "ok";
    const factorId = needsFactorInfo ? await verifiedTotpFactorId() : null;
    const next = adminSignInStep({
      access,
      mustSetPassword: mustSetPassword.current,
      hasVerifiedFactor: Boolean(factorId),
    });

    switch (next.step) {
      case "done":
        window.location.assign(nextPath);
        return;
      case "reauthenticate":
        await signOutLocally();
        setNotice("Your authenticator code is more than 7 days old. Please sign in again.");
        setStep("password");
        return;
      case "enrol_totp":
        await startEnrolment();
        return;
      case "denied":
        setDeniedReason(next.reason);
        setStep("denied");
        return;
      case "error":
        setError("Couldn't check your admin access. Try again in a moment.");
        setStep("error");
        return;
      default:
        setCode("");
        setStep(next.step);
    }
  }, [nextPath, signOutLocally, startEnrolment, verifiedTotpFactorId]);

  const started = React.useRef(false);
  React.useEffect(() => {
    // Once per page load: the hash is consumed on the first run (React runs
    // effects twice in development, and a second run would find it gone).
    if (started.current) return;
    started.current = true;
    async function init() {
      // Invite and recovery links carry the session (or an error) in the hash.
      const hash = parseAuthHash(window.location.hash);
      if (hash) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      if (hash?.kind === "error") {
        setError(
          hash.code === "otp_expired"
            ? "This link has expired. Use “Forgot your password?” below to get a new one."
            : hash.description || "This link didn't work.",
        );
      } else if (hash?.kind === "session") {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: hash.accessToken,
          refresh_token: hash.refreshToken,
        });
        if (sessionError) setError("This link didn't work. Ask a founder for a new invite.");
        else if (hash.type === "recovery") mustSetPassword.current = true;
      } else if (searchParams.get("reset") === "1") {
        // Password-reset link (PKCE): the client exchanged the code on load.
        const { data } = await supabase.auth.getSession();
        if (data.session) mustSetPassword.current = true;
      }
      // An invited admin chooses a password before anything else, even after a
      // reload (the invite link only works once).
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (user?.invited_at && !user.user_metadata?.[ADMIN_PASSWORD_SET_FLAG]) {
        mustSetPassword.current = true;
      }
      await advance();
    }
    void init();
    // Later steps call advance() themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setNotice(null);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError("Wrong email or password.");
        return;
      }
      setPassword("");
      await advance();
    });
  };

  const handleForgotPassword = () => {
    void run(async () => {
      const address = email.trim();
      if (!address) {
        setError("Enter your email first.");
        return;
      }
      await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}${ADMIN_SIGN_IN_PATH}?reset=1`,
      });
      setNotice("If this email belongs to an admin, a reset link is on its way. Open it in this browser.");
    });
  };

  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (!isStrongPassword(newPassword)) {
        setError(PASSWORD_POLICY_ERROR);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("The two passwords don't match.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { [ADMIN_PASSWORD_SET_FLAG]: true },
      });
      if (updateError) {
        setError(updateError.message || "Couldn't save the password.");
        return;
      }
      mustSetPassword.current = false;
      setNewPassword("");
      setConfirmPassword("");
      await advance();
    });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const factorId = step === "enrol_totp" ? enrolment?.factorId : await verifiedTotpFactorId();
      if (!factorId) {
        setError("No authenticator app is set up for this account.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });
      if (verifyError) {
        setError("That code didn't work. Check the time on your phone and try the newest code.");
        setCode("");
        return;
      }
      setEnrolment(null);
      await advance();
    });
  };

  const handleSignOut = () => {
    void run(async () => {
      await signOutLocally();
      setDeniedReason(null);
      setStep("password");
    });
  };

  const codeField = (
    <div className="space-y-1.5">
      <label htmlFor="admin-totp-code" className={labelClass}>
        6-digit code
      </label>
      <input
        id="admin-totp-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className={`${inputClass} tracking-[0.4em]`}
        required
      />
    </div>
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-clinical-500/90">
          DocCy internal
        </p>

        {step === "loading" ? <p className="mt-4 text-sm text-slate-400">Checking your session…</p> : null}

        {step === "password" ? (
          <>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">Admin sign-in</h1>
            <p className="mt-2 text-sm text-slate-400">
              Email and password, then the code from your authenticator app.
            </p>
            <form onSubmit={handleSignIn} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="admin-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <button type="submit" disabled={busy} className={buttonClass}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={busy}
                className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
              >
                Forgot your password?
              </button>
            </form>
          </>
        ) : null}

        {step === "set_password" ? (
          <>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">Choose your password</h1>
            <p className="mt-2 text-sm text-slate-400">{PASSWORD_POLICY_HELPER}</p>
            <form onSubmit={handleSetPassword} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-new-password" className={labelClass}>
                  New password
                </label>
                <input
                  id="admin-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="admin-confirm-password" className={labelClass}>
                  Confirm password
                </label>
                <input
                  id="admin-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <button type="submit" disabled={busy} className={buttonClass}>
                {busy ? "Saving…" : "Save password"}
              </button>
            </form>
          </>
        ) : null}

        {step === "enrol_totp" && enrolment ? (
          <>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">Set up your authenticator app</h1>
            <p className="mt-2 text-sm text-slate-400">
              Scan the code with an authenticator app (Google Authenticator, 1Password, Authy…), then
              enter the 6-digit code it shows. You’ll need it every time you sign in, and at least every
              7 days.
            </p>
            <div className="mt-5 flex justify-center rounded-2xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrolment.qrCode} alt="Authenticator QR code" width={180} height={180} />
            </div>
            <p className="mt-3 text-xs text-slate-400">Can’t scan? Enter this key instead:</p>
            <p
              data-testid="totp-secret"
              className="mt-1 break-all rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-200"
            >
              {enrolment.secret}
            </p>
            <form onSubmit={handleVerify} className="mt-5 space-y-4">
              {codeField}
              <button type="submit" disabled={busy || code.length !== 6} className={buttonClass}>
                {busy ? "Checking…" : "Verify"}
              </button>
            </form>
          </>
        ) : null}

        {step === "verify_totp" ? (
          <>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">Enter your authenticator code</h1>
            <p className="mt-2 text-sm text-slate-400">Open your authenticator app and enter the current code.</p>
            <form onSubmit={handleVerify} className="mt-6 space-y-4">
              {codeField}
              <button type="submit" disabled={busy || code.length !== 6} className={buttonClass}>
                {busy ? "Checking…" : "Verify"}
              </button>
            </form>
          </>
        ) : null}

        {step === "denied" && deniedReason ? (
          <>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">No admin access</h1>
            <p role="alert" className="mt-3 text-sm text-amber-100/95">
              {DENIED_COPY[deniedReason]}
            </p>
            <button type="button" onClick={handleSignOut} disabled={busy} className={`${buttonClass} mt-6`}>
              Sign out
            </button>
          </>
        ) : null}

        {step === "error" ? (
          <>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">Admin sign-in</h1>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`${buttonClass} mt-6`}
            >
              Try again
            </button>
          </>
        ) : null}

        {notice ? <p className="mt-4 text-sm text-slate-300">{notice}</p> : null}
        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
