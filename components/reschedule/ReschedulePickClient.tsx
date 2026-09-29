"use client";

import * as React from "react";
import { CalendarClock, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { BookingSection } from "@/components/doctor/BookingSection";
import type { RescheduleCalendarData } from "@/lib/public/load-reschedule-calendar";

type SlotItem = { iso: string; label: string };

/** Online booking first: dead ends point at the profile's calendar, never at a phone call. */
function BookOnlineLink({ href }: { href: string | null | undefined }) {
  if (!href) return null;
  return (
    <a
      href={href}
      className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-clinical-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/25 transition hover:bg-clinical-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300"
    >
      Book a new time online
    </a>
  );
}

type Props = {
  appointmentId: string;
  token: string;
  professionalName: string;
  patientFirstName: string;
  /** UTC deadline — client hides picker if the clock passes while the tab stays open. */
  expiresAtIso: string;
  expiryLabel: string;
  slots: SlotItem[];
  doctorId: string;
  /** The professional's online booking calendar for "See other times" (null if it can't load). */
  otherTimes: RescheduleCalendarData | null;
  bookOnlineHref: string | null;
};

export function ReschedulePickClient({
  appointmentId,
  token,
  professionalName,
  patientFirstName,
  expiresAtIso,
  expiryLabel,
  slots,
  doctorId,
  otherTimes,
  bookOnlineHref,
}: Props) {
  const [showOtherTimes, setShowOtherTimes] = React.useState(false);
  const [requestedLabel, setRequestedLabel] = React.useState<string | null>(null);
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

  if (requestedLabel) {
    return (
      <div
        className="mx-auto max-w-md rounded-3xl border border-amber-400/30 bg-amber-500/10 p-8 text-center shadow-xl"
        data-testid="reschedule-other-time-requested"
      >
        <Clock className="mx-auto h-14 w-14 text-amber-300" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold text-slate-50">Request sent, {patientFirstName}</h2>
        <p className="mt-2 text-sm text-slate-300">
          You asked {professionalName} for{" "}
          <span className="font-medium text-amber-100">{requestedLabel}</span> (Cyprus time).
          You&apos;ll get an email as soon as it&apos;s confirmed.
        </p>
      </div>
    );
  }

  if (expiredClient) {
    return <RescheduleExpiredPanel bookOnlineHref={bookOnlineHref} />;
  }

  if (done) {
    const picked = slots.find((s) => s.iso === selectedIso);
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-clinical-500/30 bg-clinical-500/10 p-8 text-center shadow-xl">
        <CheckCircle2
          className="mx-auto h-14 w-14 text-clinical-300"
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
              <span className="font-medium text-clinical-100">{picked.label}</span>
            </>
          ) : null}{" "}
          (Cyprus time). Check your email for calendar links.
        </p>
      </div>
    );
  }

  const locked = submitting;

  return (
    <div
      className={`mx-auto space-y-8 transition-[max-width] duration-300 ${showOtherTimes ? "max-w-3xl" : "max-w-lg"}`}
      aria-busy={locked}
    >
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-clinical-500/30 bg-clinical-500/15">
          <CalendarClock className="h-7 w-7 text-clinical-300" aria-hidden />
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

      <fieldset
        disabled={locked}
        className="m-0 space-y-3 border-0 p-0 disabled:opacity-80"
      >
        <legend className="sr-only">Proposed visit times</legend>
        {slots.map((s) => {
          const active = selectedIso === s.iso;
          return (
            <button
              key={s.iso}
              type="button"
              disabled={locked}
              aria-pressed={active}
              onClick={() => {
                if (locked) return;
                setSelectedIso(s.iso);
              }}
              className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:hover:border-slate-700/80 disabled:hover:bg-slate-900/50 ${
                active
                  ? "border-clinical-400/60 bg-clinical-400/15 shadow-lg shadow-ink-900/30"
                  : "border-slate-700/80 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/60"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                  active
                    ? "bg-clinical-400 text-slate-950"
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
      </fieldset>

      {error ? (
        <div className="rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!selectedIso || submitting}
        onClick={submit}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-clinical-400 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/25 transition hover:bg-clinical-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
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

      {otherTimes ? (
        <section
          className="space-y-4 border-t border-slate-800 pt-6"
          aria-labelledby="reschedule-other-times-title"
          data-testid="reschedule-other-times"
        >
          <div className="text-center">
            <h2 id="reschedule-other-times-title" className="text-sm font-semibold text-slate-200">
              None of these work for you?
            </h2>
            {!showOtherTimes ? (
              <button
                type="button"
                onClick={() => setShowOtherTimes(true)}
                disabled={locked}
                className="mt-3 inline-flex items-center justify-center rounded-2xl border border-clinical-400/50 px-5 py-2.5 text-sm font-semibold text-clinical-100 transition hover:bg-clinical-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300 disabled:opacity-60"
              >
                See other times
              </button>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                Pick any free time. {professionalName} will confirm it, and the three times above
                will be released.
              </p>
            )}
          </div>
          {showOtherTimes ? (
            <BookingSection
              doctorId={doctorId}
              doctorName={professionalName}
              weeklySlots={otherTimes.weeklySlots}
              takenSlotTimes={otherTimes.takenSlotTimes}
              breakStart={otherTimes.breakStart}
              breakEnd={otherTimes.breakEnd}
              onlineBookingsPaused={otherTimes.onlineBookingsPaused}
              holidayModeEnabled={otherTimes.holidayModeEnabled}
              holidayStartDate={otherTimes.holidayStartDate}
              holidayEndDate={otherTimes.holidayEndDate}
              bookingHorizonDays={otherTimes.bookingHorizonDays}
              minimumNoticeHours={otherTimes.minimumNoticeHours}
              locationId={otherTimes.locationId}
              rescheduleOf={{
                appointmentId,
                token,
                onRequested: (label) => setRequestedLabel(label),
              }}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function RescheduleExpiredPanel({ bookOnlineHref }: { bookOnlineHref?: string | null }) {
  return (
    <div
      className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900/70 p-8 text-center"
      data-testid="reschedule-expired"
    >
      <h1 className="text-xl font-semibold text-slate-50">This offer has expired</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        You didn&apos;t choose a new time in time, so this visit is no longer booked and the
        reserved times have been released.
      </p>
      <BookOnlineLink href={bookOnlineHref} />
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
    body: "It may have been replaced by a newer email, or the offer was withdrawn. Check your latest email from DocCy, or book a new time online.",
  },
  no_slots: {
    title: "No times to choose",
    body: "There are no proposed times on file for this link. You can book a new time online.",
  },
};

export function RescheduleInvalidPanel({
  reason,
  bookOnlineHref,
}: {
  reason?: RescheduleInvalidReason;
  bookOnlineHref?: string | null;
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
      <BookOnlineLink href={bookOnlineHref} />
    </div>
  );
}

export function RescheduleResolvedPanel({ bookOnlineHref }: { bookOnlineHref?: string | null }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900/70 p-8 text-center">
      <h1 className="text-xl font-semibold text-slate-50">Already sorted</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        This visit is no longer waiting for you to pick a time — for example, you
        may have already confirmed a slot, or the clinic updated the appointment.
        Check your email for the latest details.
      </p>
      <BookOnlineLink href={bookOnlineHref} />
    </div>
  );
}
