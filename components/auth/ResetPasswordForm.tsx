"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { PasswordToggleInput } from "@/components/auth/PasswordToggleInput";
import { PendingLink } from "@/components/navigation/PendingLink";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { writeProSessionHintCookie } from "@/lib/pro-session-hint";
import { FORGOT_PASSWORD_PATH } from "@/lib/password-reset";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR,
  PASSWORD_POLICY_HELPER,
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_TITLE,
  isStrongPassword,
} from "@/lib/password-policy";

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(Boolean(session?.user));
      setReady(true);
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(Boolean(session?.user));
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!isStrongPassword(password)) {
      setError(PASSWORD_POLICY_ERROR);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      const msg = String(updateError.message ?? "").toLowerCase();
      if (msg.includes("session") || msg.includes("auth")) {
        setError("This reset link is invalid or has expired. Request a new one.");
        setHasSession(false);
        return;
      }
      if (msg.includes("password") && (msg.includes("weak") || msg.includes("least"))) {
        setError(PASSWORD_POLICY_ERROR);
        return;
      }
      setError("We couldn't update your password. Please try again.");
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      try {
        await fetch("/api/auth/local-test-login-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
      } catch (syncError) {
        console.warn("[DocCy] Local test password sync failed after reset", syncError);
      }
    }

    writeProSessionHintCookie();
    try {
      await fetch("/api/auth/session-audit", { method: "POST" });
    } catch (auditError) {
      console.warn("[DocCy] Session audit failed after password reset", auditError);
    }
    router.push("/agenda");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen bg-ink-900 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-clinical-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-clinical-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-3xl border border-clinical-100/10 bg-slate-900/60 p-6 shadow-2xl shadow-ink-900/50 backdrop-blur-xl sm:p-8">
          <div className="mb-6 text-left">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tracking-[0.2em] text-clinical-200/80">
              <DocCyWordmark variant="dark" size="sm" />
              <span>· Practitioner login</span>
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Choose a new password
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Pick a password you&apos;ll remember. You&apos;ll be signed in after you save it.
            </p>
          </div>

          {!ready ? (
            <p className="text-sm text-slate-400">Checking your reset link…</p>
          ) : !hasSession ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                This reset link is invalid or has expired. Request a new one from the login page.
              </div>
              <p className="text-center text-xs text-slate-400">
                <PendingLink
                  href={FORGOT_PASSWORD_PATH}
                  className="font-medium text-clinical-300 hover:text-clinical-200"
                >
                  Forgot your password?
                </PendingLink>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
              {error ? (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
                  {error}
                </div>
              ) : null}

              <fieldset disabled={loading} className="min-w-0 space-y-5 border-0 p-0">
                <label className="block text-sm font-medium text-slate-200">
                  New password
                  <PasswordToggleInput
                    name="newPassword"
                    value={password}
                    onChange={setPassword}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    maxLength={PASSWORD_MAX_LENGTH}
                    pattern={PASSWORD_POLICY_HTML_PATTERN}
                    title={PASSWORD_POLICY_TITLE}
                    autoComplete="new-password"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-400">
                    {PASSWORD_POLICY_HELPER}
                  </span>
                </label>

                <label className="block text-sm font-medium text-slate-200">
                  Confirm new password
                  <PasswordToggleInput
                    name="confirmPassword"
                    value={confirm}
                    onChange={setConfirm}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    maxLength={PASSWORD_MAX_LENGTH}
                    pattern={PASSWORD_POLICY_HTML_PATTERN}
                    title={PASSWORD_POLICY_TITLE}
                    autoComplete="new-password"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-clinical-400 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/30 transition hover:bg-clinical-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-wait disabled:opacity-90"
                >
                  {loading ? (
                    <>
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-950 border-r-transparent"
                      />
                      Updating your password…
                    </>
                  ) : (
                    "Save new password"
                  )}
                </button>
              </fieldset>
            </form>
          )}
        </div>
      </div>

      <div
        aria-hidden={!loading}
        className={`fixed inset-0 z-50 flex items-center justify-center bg-ink-900/75 backdrop-blur-[3px] transition-opacity duration-200 ${
          loading ? "pointer-events-auto cursor-wait opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          role="status"
          aria-live="assertive"
          data-testid="password-reset-busy"
          className="mx-4 flex max-w-md items-center gap-3 rounded-2xl border border-clinical-100/20 bg-slate-900 px-5 py-4 shadow-2xl shadow-ink-900/80"
        >
          <span
            aria-hidden
            className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-clinical-400 border-r-transparent"
          />
          <div>
            <p className="text-sm font-semibold text-slate-50">Updating your password…</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Please wait on this page. Do not close the tab until you reach your agenda.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
