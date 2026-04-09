"use client";

import * as React from "react";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";

type SlotItem = { iso: string; label: string };

type Props = {
  appointmentId: string;
  token: string;
  professionalName: string;
  patientFirstName: string;
  /** UTC deadline — client hides picker if the clock passes while the tab stays open. */
  expiresAtIso: string;
  expiryLabel: string;
  slots: SlotItem[];
};

export function ReschedulePickClient({
  appointmentId,
  token,
  professionalName,
  patientFirstName,
  expiresAtIso,
  expiryLabel,
  slots,
}: Props) {
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [expiredClient, setExpiredClient] = React.useState(
    () => Date.now() >= new Date(expiresAtIso).getTime()
  );

  React.useEffect(() => {
    if (expiredClient) return;
    const expMs = new Date(expiresAtIso).getTime();
    const delay = Math.max(0, expMs - Date.now());
    const id = window.setTimeout(() => setExpiredClient(true), delay);
    return () => window.clearTimeout(id);
  }, [expiresAtIso, expiredClient]);

  async function submit() {
    if (!selectedIso || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/reschedule/${encodeURIComponent(appointmentId)}/select`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, selectedStartIso: selectedIso }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          typeof data?.message === "string"
            ? data.message
            : "Could not confirm this time."
        );
        setSubmitting(false);
        return;
      }
      setDone(true);
      return;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (expiredClient) {
    return <RescheduleExpiredPanel />;
  }

  if (done) {
    const picked = slots.find((s) => s.iso === selectedIso);
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center shadow-xl">
        <CheckCircle2
          className="mx-auto h-14 w-14 text-emerald-300"
          aria-hidden
        />
        <h2 className="mt-4 text-xl font-semibold text-slate-50">
          You&apos;re all set, {patientFirstName}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Your visit with {professionalName} is confirmed
          {picked ? (
            <>
              {" "}
              for{" "}
              <span className="font-medium text-emerald-100">{picked.label}</span>
            </>
          ) : null}{" "}
          (Cyprus time). Check your email for calendar links.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/15">
          <CalendarClock className="h-7 w-7 text-sky-300" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-50">
          Pick a time
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-400">
          <span className="font-medium text-slate-200">{professionalName}</span>{" "}
          has reserved these times for you, {patientFirstName}. Choose one before{" "}
          <span className="font-medium text-amber-200/95">{expiryLabel}</span> (Cyprus
          time) to confirm your visit.
        </p>
      </div>

      <div className="space-y-3">
        {slots.map((s) => {
          const active = selectedIso === s.iso;
          return (
            <button
              key={s.iso}
              type="button"
              onClick={() => setSelectedIso(s.iso)}
              className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition ${
                active
                  ? "border-emerald-400/60 bg-emerald-400/15 shadow-lg shadow-emerald-950/30"
                  : "border-slate-700/80 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/60"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                  active
                    ? "bg-emerald-400 text-slate-950"
                    : "border border-slate-600 bg-slate-800 text-slate-400"
                }`}
              >
                {slots.indexOf(s) + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-slate-100">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!selectedIso || submitting}
        onClick={submit}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Confirming…
          </>
        ) : (
          "Confirm this time"
        )}
      </button>
    </div>
  );
}

export function RescheduleExpiredPanel() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900/70 p-8 text-center">
      <h1 className="text-xl font-semibold text-slate-50">This offer has expired</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        The reserved times are no longer held. Please visit the professional&apos;s
        profile and submit a new appointment request when it suits you.
      </p>
    </div>
  );
}

export type RescheduleInvalidReason =
  | "missing_token"
  | "not_found"
  | "link_revoked"
  | "no_slots";

const INVALID_COPY: Record<
  RescheduleInvalidReason,
  { title: string; body: string }
> = {
  missing_token: {
    title: "Link incomplete",
    body: "This address is missing part of the link from your email. Open the message again and tap the full link, or ask the clinic to resend it.",
  },
  not_found: {
    title: "We couldn’t find this visit",
    body: "The link may be wrong or very old. If you need to book or reschedule, contact the clinic or use their public booking page.",
  },
  link_revoked: {
    title: "This link no longer works",
    body: "It may have been replaced by a newer email, or the offer was withdrawn. If you still need to pick a time, ask the clinic to send a fresh link.",
  },
  no_slots: {
    title: "No times to choose",
    body: "There are no proposed slots on file for this link. Please contact the clinic so they can send options again.",
  },
};

export function RescheduleInvalidPanel({
  reason,
}: {
  reason?: RescheduleInvalidReason;
}) {
  const { title, body } = reason
    ? INVALID_COPY[reason]
    : {
        title: "We can’t use this link",
        body: "It may be incomplete, incorrect, or no longer active. If you’ve already chosen a time, check your confirmation email. Otherwise contact the clinic.",
      };
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900/70 p-8 text-center">
      <h1 className="text-xl font-semibold text-slate-50">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

export function RescheduleResolvedPanel() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900/70 p-8 text-center">
      <h1 className="text-xl font-semibold text-slate-50">Already sorted</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        This visit is no longer waiting for you to pick a time — for example, you
        may have already confirmed a slot, or the clinic updated the appointment.
        Check your email for the latest details, or contact the clinic if
        something looks wrong.
      </p>
    </div>
  );
}
