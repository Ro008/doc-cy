"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FIRST_LOGIN_TRIAL_NOTICE_TEST_ID,
  TRIAL_NOTICE_DISMISS_PATH,
  firstLoginTrialNoticeCopy,
} from "@/lib/first-login-trial-notice";

export function FirstLoginTrialNotice({ isFounder }: { isFounder: boolean }) {
  const router = useRouter();
  const copy = firstLoginTrialNoticeCopy(isFounder);
  const [open, setOpen] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dismiss = React.useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(TRIAL_NOTICE_DISMISS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(payload?.message || "Could not save. Try again.");
        setSaving(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not save. Try again.");
      setSaving(false);
    }
  }, [router, saving]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-ink-900/65 backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-login-trial-title"
        data-testid={FIRST_LOGIN_TRIAL_NOTICE_TEST_ID}
        className="fixed left-1/2 top-[max(4.5rem,12vh)] z-[90] w-[min(calc(100vw-1.25rem),24rem)] -translate-x-1/2 rounded-2xl border border-clinical-400/25 bg-slate-900/98 p-5 shadow-[0_0_0_1px_rgba(18,184,192,0.12),0_24px_48px_-12px_rgba(0,0,0,0.65),0_0_40px_-12px_rgba(18,184,192,0.25)] backdrop-blur-xl"
      >
        <h2
          id="first-login-trial-title"
          className="text-lg font-semibold tracking-tight text-slate-50"
        >
          {copy.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{copy.intro}</p>
        {copy.founderPrice ? (
          <p className="mt-3 text-sm leading-relaxed text-clinical-100/95">{copy.founderPrice}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          autoFocus
          disabled={saving}
          onClick={() => void dismiss()}
          className="mt-5 w-full rounded-xl border-2 border-clinical-400/45 bg-clinical-400/15 py-2.5 text-sm font-semibold text-clinical-100 shadow-[0_0_24px_-8px_rgba(18,184,192,0.45)] transition hover:border-clinical-300/70 hover:bg-clinical-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? "Saving…" : copy.cta}
        </button>
      </div>
    </>
  );
}
