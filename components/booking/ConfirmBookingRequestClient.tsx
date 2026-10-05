"use client";

import * as React from "react";

import { BookingLinkCard, BookingLinkText, BookOnlineButton } from "@/components/booking/BookingLinkPanels";

type Props = {
  token: string;
  professionalName: string;
  whenLabel: string;
  clinicLabel: string;
  bookOnlineHref: string | null;
};

type Outcome =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; title: string; message: string };

/**
 * The button on /booking/confirm. Opening the emailed link only shows this page (email
 * scanners open links); the request goes through when the patient presses the button.
 */
export function ConfirmBookingRequestClient({ token, professionalName, whenLabel, clinicLabel, bookOnlineHref }: Props) {
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" });

  async function confirm() {
    if (outcome.kind === "sending") return;
    setOutcome({ kind: "sending" });
    try {
      const res = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string; state?: string };
      if (res.ok) {
        setOutcome({ kind: "sent" });
      } else if (res.status === 409 && data.code === "slot_taken") {
        setOutcome({
          kind: "error",
          title: "That time was just booked",
          message: "Someone else booked this time a moment ago. Please choose another time.",
        });
      } else if (res.status === 409 && data.code === "open_request_exists") {
        setOutcome({
          kind: "error",
          title: "You already have a request",
          message: `You already have a request waiting with ${professionalName}. Please wait for their reply.`,
        });
      } else if (res.status === 410) {
        setOutcome({
          kind: "error",
          title:
            data.state === "used"
              ? "Already confirmed"
              : data.state === "replaced"
                ? "You sent a newer request"
                : "This link has expired",
          message:
            data.state === "used"
              ? "This request was already confirmed."
              : data.state === "replaced"
                ? "This request was replaced by a newer one. Use the link in your latest email."
                : "Confirmation links work for 30 minutes. Please book your time again.",
        });
      } else {
        setOutcome({
          kind: "error",
          title: "Something went wrong",
          message: data.message ?? "Please try again in a moment.",
        });
      }
    } catch {
      setOutcome({ kind: "error", title: "Something went wrong", message: "Please check your connection and try again." });
    }
  }

  if (outcome.kind === "sent") {
    return (
      <BookingLinkCard title="Request sent" testId="booking-confirm-sent">
        <BookingLinkText>
          We&apos;ve sent your request to <strong className="text-slate-200">{professionalName}</strong> for{" "}
          {whenLabel}. They will review it and you&apos;ll get an email as soon as they reply.
        </BookingLinkText>
        <BookingLinkText>Please don&apos;t add this visit to your calendar until it is confirmed.</BookingLinkText>
      </BookingLinkCard>
    );
  }

  if (outcome.kind === "error") {
    return (
      <BookingLinkCard title={outcome.title} testId="booking-confirm-error">
        <BookingLinkText>{outcome.message}</BookingLinkText>
        <BookOnlineButton href={bookOnlineHref} />
      </BookingLinkCard>
    );
  }

  return (
    <BookingLinkCard title="Confirm your request" testId="booking-confirm">
      <BookingLinkText>
        You asked for a visit with <strong className="text-slate-200">{professionalName}</strong>:
      </BookingLinkText>
      <p className="mt-4 rounded-2xl border border-slate-700 bg-ink-900/60 px-4 py-3 text-sm text-slate-200">
        {whenLabel}
        <br />
        <span className="text-slate-400">{clinicLabel}</span>
      </p>
      <button
        type="button"
        onClick={confirm}
        disabled={outcome.kind === "sending"}
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-clinical-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/25 transition hover:bg-clinical-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300 disabled:opacity-60"
      >
        {outcome.kind === "sending" ? "Sending…" : "Confirm my request"}
      </button>
      <BookingLinkText>Your request is not sent until you confirm.</BookingLinkText>
    </BookingLinkCard>
  );
}
