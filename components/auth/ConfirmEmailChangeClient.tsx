"use client";

import * as React from "react";

import { BookingLinkCard, BookingLinkText } from "@/components/booking/BookingLinkPanels";
import { confirmEmailChangeOutcome } from "@/lib/account-email-change";

type Outcome = { kind: "idle" } | { kind: "sending" } | { kind: "done"; ok: boolean; title: string; message: string };

/**
 * The button on /account/confirm-email. Opening the emailed link only shows this page
 * (email scanners open links); her email changes when she presses the button.
 */
export function ConfirmEmailChangeClient({ token, newEmail }: { token: string; newEmail: string }) {
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" });

  async function confirm() {
    if (outcome.kind === "sending") return;
    setOutcome({ kind: "sending" });
    try {
      const res = await fetch("/api/account/email-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json().catch(() => null)) as { email?: unknown } | null;
      setOutcome({ kind: "done", ...confirmEmailChangeOutcome(res.status, body) });
    } catch {
      setOutcome({ kind: "done", ...confirmEmailChangeOutcome(0, null) });
    }
  }

  if (outcome.kind === "done") {
    return (
      <BookingLinkCard title={outcome.title} testId={outcome.ok ? "confirm-email-done" : "confirm-email-error"}>
        <BookingLinkText>{outcome.message}</BookingLinkText>
        {outcome.ok ? (
          <a
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-clinical-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/25 transition hover:bg-clinical-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300"
          >
            Sign in
          </a>
        ) : null}
      </BookingLinkCard>
    );
  }

  return (
    <BookingLinkCard title="Confirm your new email" testId="confirm-email">
      <BookingLinkText>Your DocCy account will use this address:</BookingLinkText>
      <p className="mt-4 break-all rounded-2xl border border-slate-700 bg-ink-900/60 px-4 py-3 text-sm text-slate-200">
        {newEmail}
      </p>
      <button
        type="button"
        onClick={confirm}
        disabled={outcome.kind === "sending"}
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-clinical-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/25 transition hover:bg-clinical-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300 disabled:opacity-60"
      >
        {outcome.kind === "sending" ? "Confirming…" : "Confirm new email"}
      </button>
      <BookingLinkText>
        Booking requests will be sent to it. You will be signed out on all devices and sign in again with this
        address. Nothing changes until you confirm.
      </BookingLinkText>
    </BookingLinkCard>
  );
}
