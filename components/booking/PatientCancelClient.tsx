"use client";

import * as React from "react";

import { BookingLinkCard, BookingLinkText, BookOnlineButton } from "@/components/booking/BookingLinkPanels";

type Props = {
  token: string;
  professionalName: string;
  whenLabel: string;
  clinicLabel: string;
  deadlineLabel: string;
  bookOnlineHref: string | null;
};

type Outcome =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "cancelled" }
  | { kind: "error"; title: string; message: string; phone?: string | null };

/**
 * The button on /booking/cancel. Opening the emailed link only shows the visit (email
 * scanners open links); the visit is cancelled when the patient presses the button.
 */
export function PatientCancelClient({ token, professionalName, whenLabel, clinicLabel, deadlineLabel, bookOnlineHref }: Props) {
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" });
  const [reason, setReason] = React.useState("");

  async function cancel() {
    if (outcome.kind === "sending") return;
    setOutcome({ kind: "sending" });
    try {
      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason: reason.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string; clinicPhone?: string | null };
      if (res.ok) return setOutcome({ kind: "cancelled" });
      if (res.status === 403 && data.code === "window_closed") {
        return setOutcome({
          kind: "error",
          title: "Online cancellation has closed",
          message: "It's too close to the visit to cancel online. Please call the clinic.",
          phone: data.clinicPhone ?? null,
        });
      }
      setOutcome({
        kind: "error",
        title: res.status === 409 || res.status === 410 ? "This link no longer works" : "Something went wrong",
        message: data.message ?? "Please try again in a moment.",
      });
    } catch {
      setOutcome({ kind: "error", title: "Something went wrong", message: "Please check your connection and try again." });
    }
  }

  if (outcome.kind === "cancelled") {
    return (
      <BookingLinkCard title="Appointment cancelled" testId="patient-cancel-done">
        <BookingLinkText>
          Your visit with <strong className="text-slate-200">{professionalName}</strong> on {whenLabel} is cancelled.
          We&apos;ve let them know.
        </BookingLinkText>
        <BookOnlineButton href={bookOnlineHref} label="Book another time online" />
      </BookingLinkCard>
    );
  }

  if (outcome.kind === "error") {
    return (
      <BookingLinkCard title={outcome.title} testId="patient-cancel-error">
        <BookingLinkText>{outcome.message}</BookingLinkText>
        {outcome.phone ? (
          <a href={`tel:${outcome.phone}`} className="mt-4 inline-block text-lg font-semibold text-clinical-300">
            {outcome.phone}
          </a>
        ) : null}
      </BookingLinkCard>
    );
  }

  return (
    <BookingLinkCard title="Cancel your appointment?" testId="patient-cancel">
      <BookingLinkText>
        Your visit with <strong className="text-slate-200">{professionalName}</strong>:
      </BookingLinkText>
      <p className="mt-4 rounded-2xl border border-slate-700 bg-ink-900/60 px-4 py-3 text-sm text-slate-200">
        {whenLabel}
        <br />
        <span className="text-slate-400">{clinicLabel}</span>
      </p>
      <label htmlFor="cancelReason" className="mt-5 block text-left text-xs font-medium text-slate-400">
        Message for {professionalName} (optional)
      </label>
      <textarea
        id="cancelReason"
        value={reason}
        maxLength={1000}
        rows={3}
        onChange={(e) => setReason(e.target.value)}
        className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none"
        placeholder="e.g. I can't make it that day."
      />
      <button
        type="button"
        onClick={cancel}
        disabled={outcome.kind === "sending"}
        className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
      >
        {outcome.kind === "sending" ? "Cancelling…" : "Cancel appointment"}
      </button>
      <BookingLinkText>You can cancel online until {deadlineLabel} (Cyprus time).</BookingLinkText>
    </BookingLinkCard>
  );
}
