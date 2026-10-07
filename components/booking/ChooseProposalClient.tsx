"use client";

import * as React from "react";

import { BookingLinkCard, BookingLinkText, BookOnlineButton } from "@/components/booking/BookingLinkPanels";

type Slot = { iso: string; label: string };

/** Where the proposed times are; the address opens the clinic's Maps pin. */
export type ChooseProposalClinic = {
  name: string;
  address: string | null;
  mapsUrl: string | null;
  phoneDisplay: string | null;
  telHref: string | null;
};

type Props = {
  token: string;
  professionalName: string;
  clinic: ChooseProposalClinic;
  /** The clinic the patient asked for, when the times are at another one (user, 2026-10-07). */
  requestedClinicName: string | null;
  expiryLabel: string;
  slots: Slot[];
  bookOnlineHref: string | null;
};

type Outcome =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "confirmed"; label: string }
  | { kind: "declined" }
  | { kind: "error"; title: string; message: string };

/**
 * /booking/choose: the patient picks one of the proposed times or declines them all
 * (user, 2026-10-04; no "ask for another time"). Opening the link changes nothing.
 */
export function ChooseProposalClient({
  token,
  professionalName,
  clinic,
  requestedClinicName,
  expiryLabel,
  slots,
  bookOnlineHref,
}: Props) {
  const [picked, setPicked] = React.useState<string>(slots.length === 1 ? slots[0]!.iso : "");
  const [declining, setDeclining] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" });
  const one = slots.length === 1;

  async function post(path: string, payload: Record<string, unknown>): Promise<Response | null> {
    setOutcome({ kind: "sending" });
    try {
      return await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...payload }),
      });
    } catch {
      setOutcome({ kind: "error", title: "Something went wrong", message: "Please check your connection and try again." });
      return null;
    }
  }

  function failed(res: Response, data: { message?: string; state?: string; code?: string }) {
    if (res.status === 403 && data.code === "professional_signed_in") {
      return setOutcome({
        kind: "error",
        title: "You're signed in as a professional",
        message: "Professionals can't answer a proposal as a patient. Sign out first, then open the link again.",
      });
    }
    if (res.status === 409) {
      return setOutcome({
        kind: "error",
        title: "That time is no longer free",
        message: "Someone else took it a moment ago. You can book another time online.",
      });
    }
    if (res.status === 410) {
      return setOutcome({
        kind: "error",
        title: data.state === "expired" ? "These times have expired" : "This link no longer works",
        message: data.state === "expired" ? "The reserved times were released. You can book a new time online." : "This proposal was already answered.",
      });
    }
    setOutcome({ kind: "error", title: "Something went wrong", message: data.message ?? "Please try again in a moment." });
  }

  async function confirm() {
    if (!picked || outcome.kind === "sending") return;
    const res = await post("/api/booking/choose", { slot: picked });
    if (!res) return;
    const data = (await res.json().catch(() => ({}))) as { message?: string; state?: string; code?: string };
    if (res.ok) {
      return setOutcome({ kind: "confirmed", label: slots.find((s) => s.iso === picked)?.label ?? "" });
    }
    failed(res, data);
  }

  async function decline() {
    if (outcome.kind === "sending") return;
    const res = await post("/api/booking/decline-proposal", { message: message.trim() || undefined });
    if (!res) return;
    const data = (await res.json().catch(() => ({}))) as { message?: string; state?: string; code?: string };
    if (res.ok) return setOutcome({ kind: "declined" });
    failed(res, data);
  }

  if (outcome.kind === "confirmed") {
    return (
      <BookingLinkCard title="Visit confirmed" testId="choose-confirmed">
        <BookingLinkText>
          Your visit with <strong className="text-slate-200">{professionalName}</strong> is confirmed for {outcome.label}.
          We&apos;ve emailed you the details and a calendar invite.
        </BookingLinkText>
      </BookingLinkCard>
    );
  }
  if (outcome.kind === "declined") {
    return (
      <BookingLinkCard title="Times declined" testId="choose-declined">
        <BookingLinkText>We&apos;ve let {professionalName} know. You can book another time online whenever you like.</BookingLinkText>
        <BookOnlineButton href={bookOnlineHref} />
      </BookingLinkCard>
    );
  }
  if (outcome.kind === "error") {
    return (
      <BookingLinkCard title={outcome.title} testId="choose-error">
        <BookingLinkText>{outcome.message}</BookingLinkText>
        <BookOnlineButton href={bookOnlineHref} />
      </BookingLinkCard>
    );
  }

  const sending = outcome.kind === "sending";
  return (
    <BookingLinkCard title={one ? "A new time for your visit" : "Choose a time"} testId="choose-proposal">
      <BookingLinkText>
        <strong className="text-slate-200">{professionalName}</strong> can&apos;t see you at the time you asked for and
        reserved {one ? "this time" : "these times"} for you at{" "}
        <strong className="text-slate-200">{clinic.name}</strong>. Answer before {expiryLabel} (Cyprus time).
      </BookingLinkText>

      {requestedClinicName ? (
        <div
          data-testid="choose-other-clinic"
          className="mt-4 rounded-2xl border-2 border-amber-500/80 bg-amber-500/15 px-4 py-3 text-left"
        >
          <p className="text-xs font-extrabold uppercase tracking-wide text-amber-300">At a different clinic</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-100">
            {one ? "This time is" : "These times are"} at <strong>{clinic.name}</strong>, not at {requestedClinicName}{" "}
            where you asked to be seen.
          </p>
        </div>
      ) : null}

      <div data-testid="choose-clinic" className="mt-4 rounded-2xl border border-slate-700 bg-ink-900/60 px-4 py-3 text-left text-sm">
        <p className="font-semibold text-slate-100">{clinic.name}</p>
        {clinic.address ? (
          clinic.mapsUrl ? (
            <a
              href={clinic.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block text-clinical-300 hover:text-clinical-200"
            >
              {clinic.address}
            </a>
          ) : (
            <p className="mt-0.5 text-slate-300">{clinic.address}</p>
          )
        ) : null}
        {clinic.phoneDisplay && clinic.telHref ? (
          <a
            href={clinic.telHref}
            className="mt-1 block text-clinical-300 hover:text-clinical-200"
          >
            {clinic.phoneDisplay}
          </a>
        ) : null}
      </div>

      {!declining ? (
        <>
          <fieldset className="mt-5 space-y-2 text-left">
            <legend className="sr-only">Proposed times</legend>
            {slots.map((slot) => (
              <label
                key={slot.iso}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                  picked === slot.iso
                    ? "border-clinical-400/70 bg-clinical-400/10 text-clinical-100"
                    : "border-slate-700 bg-ink-900/60 text-slate-200 hover:border-slate-500"
                }`}
              >
                <input
                  type="radio"
                  name="proposedSlot"
                  value={slot.iso}
                  checked={picked === slot.iso}
                  onChange={() => setPicked(slot.iso)}
                />
                {slot.label}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={confirm}
            disabled={!picked || sending}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-clinical-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/25 transition hover:bg-clinical-300 disabled:opacity-60"
          >
            {sending ? "Confirming…" : "Confirm this time"}
          </button>
          <button
            type="button"
            onClick={() => setDeclining(true)}
            disabled={sending}
            className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-red-500/30 px-4 py-3 text-sm font-medium text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
          >
            {one ? "Decline this time" : "Decline these times"}
          </button>
        </>
      ) : (
        <>
          <label htmlFor="declineMessage" className="mt-5 block text-left text-xs font-medium text-slate-400">
            Message for {professionalName} (optional)
          </label>
          <textarea
            id="declineMessage"
            value={message}
            maxLength={1000}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 focus:border-clinical-500/50 focus:outline-none"
            placeholder="e.g. None of these work for me."
          />
          <BookingLinkText>Declining closes this request. You can book another time online afterwards.</BookingLinkText>
          <button
            type="button"
            onClick={decline}
            disabled={sending}
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
          >
            {sending ? "Declining…" : one ? "Decline this time" : "Decline these times"}
          </button>
          <button
            type="button"
            onClick={() => setDeclining(false)}
            disabled={sending}
            className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
          >
            Go back
          </button>
        </>
      )}
    </BookingLinkCard>
  );
}
