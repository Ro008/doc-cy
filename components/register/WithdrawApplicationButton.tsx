"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Status page, pending application: withdraw it after a confirmation step.
 * The page then shows "Your application was withdrawn" with "Apply again".
 */
export function WithdrawApplicationButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function withdraw() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/register/withdraw", { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          setError(body?.message ?? "Could not withdraw your application. Try again.");
          if (res.status === 409) router.refresh();
          return;
        }
        router.refresh();
      } catch {
        setError("Could not withdraw your application. Check your connection and try again.");
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-slate-400 underline underline-offset-4 hover:text-slate-200"
        data-testid="withdraw-application"
      >
        Withdraw my application
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/40 p-4" data-testid="withdraw-application-confirm">
      <p className="text-sm text-slate-300">
        Withdraw your application? Our team will stop reviewing it. You can apply again later with this account.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={withdraw}
          disabled={isPending}
          className="inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="withdraw-application-yes"
        >
          {isPending ? "Withdrawing..." : "Yes, withdraw it"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={isPending}
          className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-clinical-400/50"
        >
          Keep it
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
