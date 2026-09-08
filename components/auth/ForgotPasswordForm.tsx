"use client";

import { useState, type FormEvent } from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";

export function ForgotPasswordForm({
  initialEmail = "",
  invalidLink = false,
}: {
  initialEmail?: string;
  invalidLink?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    invalidLink
      ? "That reset link is invalid or has expired. Request a new one below."
      : null,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.status === 429) {
        setError("Too many reset emails. Please wait a minute and try again.");
        return;
      }
      if (!res.ok) {
        setError("We couldn't send the reset email. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("We couldn't send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
              <DocCyWordmark variant="dark" size="sm" />
              <span>· Practitioner login</span>
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Enter the email you used to register. We&apos;ll send a one-time link so you can
              choose a new password.
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-clinical-400/40 bg-clinical-500/10 px-4 py-3 text-sm text-clinical-50">
                If that email is registered on DocCy, you&apos;ll receive a reset link shortly.
                Check your inbox and spam folder.
              </div>
              <p className="text-center text-xs text-slate-400">
                <PendingLink
                  href="/login"
                  className="font-medium text-clinical-300 hover:text-clinical-200"
                >
                  Back to sign in
                </PendingLink>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error ? (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
                  {error}
                </div>
              ) : null}

              <label className="block text-sm font-medium text-slate-200">
                Email
                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-clinical-400 focus:ring-2 focus:ring-clinical-400/40"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-clinical-400 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/30 transition hover:bg-clinical-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Sending link..." : "Send reset link"}
              </button>

              <p className="text-center text-xs text-slate-400">
                <PendingLink
                  href="/login"
                  className="font-medium text-clinical-300 hover:text-clinical-200"
                >
                  Back to sign in
                </PendingLink>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
