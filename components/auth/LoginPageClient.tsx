"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { PasswordToggleInput } from "@/components/auth/PasswordToggleInput";
import { PendingLink } from "@/components/navigation/PendingLink";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { writeProSessionHintCookie } from "@/lib/pro-session-hint";
import { forgotPasswordPathWithEmail } from "@/lib/password-reset";
import { postLoginDestination } from "@/lib/doctor-routes";
import { normalizeSignInCode } from "@/lib/professional-email-step";

async function signedInAsProfessional(): Promise<boolean> {
  try {
    const response = await fetch("/api/account/summary", { cache: "no-store" });
    if (!response.ok) return true;
    const summary = (await response.json()) as { kind?: string };
    return summary.kind === "professional";
  } catch {
    return true;
  }
}

const SIGN_IN_ERRORS: Record<string, string> = {
  invalid_credentials: "Invalid email or password. Please try again.",
  email_not_confirmed: "Confirm your email first. Open the one-click link we sent when you registered.",
  too_many_emails: "We've sent several sign-in emails in the last hour. Use the newest one, or try again later.",
  send_failed: "We couldn't send your sign-in email. Please try again in a moment.",
};
const SIGN_IN_ERROR_FALLBACK = "We couldn't sign you in right now. Please try again in a moment.";

export function LoginPageClient({
  nextPath,
  linkInvalid = false,
  signInAgain = false,
  signOutFirst = false,
}: {
  nextPath?: string | null;
  /** Came back from a sign-in link that was expired or already used. */
  linkInvalid?: boolean;
  /** Her 30 days since the last emailed link are over. */
  signInAgain?: boolean;
  /** A professional session without the emailed step: drop it before signing in. */
  signOutFirst?: boolean;
}) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const destination = postLoginDestination(nextPath);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    linkInvalid
      ? "This sign-in link has expired or was already used. Sign in again and we'll email you a new one."
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  /** Set once the password is right and the link is on its way: the email it went to. */
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (signOutFirst) void supabase.auth.signOut({ scope: "local" });
    setIsHydrated(true);
  }, [signOutFirst, supabase]);

  async function finishSignIn(isProfessional: boolean) {
    try {
      await fetch("/api/auth/session-audit", { method: "POST" });
    } catch (auditError) {
      console.warn("[DocCy] Session audit failed", auditError);
    }
    // The professional chrome hint only for a real profile: an applicant (or an account
    // with nothing) gets Support and Log out only, so no full menu should flash first.
    if (isProfessional) writeProSessionHintCookie();
    router.push(destination);
    router.refresh();
  }

  async function requestSignIn(): Promise<boolean> {
    const response = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, next: nextPath ?? null }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      step?: string;
      reason?: string;
      email?: string;
    };
    if (!response.ok || !result.ok) {
      setError(SIGN_IN_ERRORS[result.reason ?? ""] ?? SIGN_IN_ERROR_FALLBACK);
      return false;
    }
    if (result.step === "email_sent") {
      setEmailSentTo(result.email ?? email);
      return true;
    }
    await finishSignIn(await signedInAsProfessional());
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestSignIn();
    } catch (signInError) {
      console.error("[DocCy] Login failed", signInError);
      setError(SIGN_IN_ERROR_FALLBACK);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResent(false);
    setLoading(true);
    try {
      if (await requestSignIn()) setResent(true);
    } catch {
      setError(SIGN_IN_ERROR_FALLBACK);
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = normalizeSignInCode(code);
    if (!token || !emailSentTo) {
      setError("Enter the code from the email (digits only).");
      return;
    }
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: emailSentTo,
      token,
      type: "email",
    });
    if (verifyError) {
      setError("That code is wrong or has expired. Check the newest email, or send a new one.");
      setLoading(false);
      return;
    }
    await finishSignIn(true);
  }

  const inputClass =
    "mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-clinical-400 focus:ring-2 focus:ring-clinical-400/40";
  const primaryButtonClass =
    "mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-clinical-400 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/30 transition hover:bg-clinical-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-70";
  const errorBox = error ? (
    <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
      {error}
    </div>
  ) : null;

  return (
    <main className="min-h-screen bg-ink-900 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-clinical-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-clinical-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-3xl border border-clinical-100/10 bg-slate-900/60 p-6 shadow-2xl shadow-ink-900/50 backdrop-blur-xl sm:p-8">
          <div className="mb-6 text-left">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tracking-[0.2em] text-clinical-200/80">
              <PendingLink href="/" className="inline-flex shrink-0 transition hover:opacity-90">
                <DocCyWordmark variant="dark" size="sm" />
              </PendingLink>
              <span>· Practitioner login</span>
            </p>
            {emailSentTo ? (
              <>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                  Check your email
                </h1>
                <p className="mt-2 text-sm text-slate-300">
                  We sent a sign-in link to{" "}
                  <span className="font-semibold text-slate-100">{emailSentTo}</span>. Open it on this
                  device, or enter the code from the email here. The link and the code last 1 hour.
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                  Welcome back
                </h1>
                <p className="mt-2 text-sm text-slate-300">
                  Sign in to your practice agenda to review today&apos;s patients and
                  upcoming appointments.
                </p>
                {signInAgain && !error ? (
                  <p className="mt-3 rounded-2xl border border-clinical-400/30 bg-clinical-400/10 px-4 py-3 text-xs text-clinical-100">
                    For your security, please sign in again. We&apos;ll email you a sign-in link.
                  </p>
                ) : null}
              </>
            )}
          </div>

          {emailSentTo ? (
            <form onSubmit={handleCode} className="space-y-5">
              {errorBox}
              {resent && !error ? (
                <p role="status" className="text-xs text-clinical-200">
                  We sent a new email. Use the newest link or code: the older ones no longer work.
                </p>
              ) : null}
              <label className="block text-sm font-medium text-slate-200">
                Code from the email
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${inputClass} tracking-[0.3em]`}
                />
              </label>
              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? "Checking..." : "Continue"}
              </button>
              <div className="flex flex-col items-center gap-2 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={loading}
                  className="font-medium text-clinical-300 hover:text-clinical-200 disabled:opacity-60"
                >
                  Send a new email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailSentTo(null);
                    setCode("");
                    setError(null);
                    setResent(false);
                  }}
                  className="font-medium text-slate-300 hover:text-slate-100"
                >
                  Use a different account
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorBox}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200">
                  Email
                  <input
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200">
                  Password
                  <PasswordToggleInput
                    name="password"
                    value={password}
                    onChange={(next) => setPassword(next)}
                    required
                    className="w-full border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-clinical-400 focus:ring-2 focus:ring-clinical-400/40"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isHydrated}
              className={primaryButtonClass}
            >
              {loading ? "Signing in..." : !isHydrated ? "Preparing sign in..." : "Sign in"}
            </button>
          </form>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            <PendingLink
              href={forgotPasswordPathWithEmail(email)}
              className="font-medium text-clinical-300 hover:text-clinical-200"
            >
              Forgot your password?
            </PendingLink>
          </p>
          <p className="mt-3 text-center text-xs text-slate-400">
            Don&apos;t have an account?{" "}
            <PendingLink
              href="/register"
              className="font-medium text-clinical-300 hover:text-clinical-200"
            >
              Create your profile
            </PendingLink>
          </p>
          <p className="mt-3 text-center text-xs text-slate-400">
            Looking for a health professional?{" "}
            <PendingLink
              href="/"
              className="font-medium text-clinical-300 hover:text-clinical-200"
            >
              Find a professional
            </PendingLink>
          </p>
        </div>
      </div>
    </main>
  );
}
