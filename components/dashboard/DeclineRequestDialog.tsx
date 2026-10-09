"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { Loader2 } from "lucide-react";
import { CY_TZ } from "@/lib/appointments";

const REASON_MIN = 10;

type DeclinableRequest = {
  id: string;
  patient_name: string | null;
  appointment_datetime: string;
};

/** Decline a booking request with a message for the patient (POST /reject). */
export function DeclineRequestDialog({
  row,
  onClose,
  onDeclined,
}: {
  row: DeclinableRequest;
  onClose: () => void;
  onDeclined: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const submittingRef = React.useRef(false);
  submittingRef.current = submitting;

  React.useEffect(() => {
    textareaRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submittingRef.current) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (submitting || reason.trim().length < REASON_MIN) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(row.id)}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = typeof data?.message === "string" ? data.message : "We could not decline this request.";
        setError(message);
        toast.error(message);
        setSubmitting(false);
        return;
      }
      toast.success("Request declined. The patient has been notified.");
      onDeclined();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const start = new Date(row.appointment_datetime);

  // Portal to <body>: a blurred or transformed ancestor would otherwise trap `fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm disabled:cursor-wait"
        aria-label="Close"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="decline-request-title"
        aria-busy={submitting}
        className="relative z-10 w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <h2 id="decline-request-title" className="text-lg font-semibold text-slate-50">
          Decline this request?
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {row.patient_name} · {formatInTimeZone(start, CY_TZ, "EEE d MMM, HH:mm")}
        </p>
        <p className="mt-3 text-sm text-slate-300">
          The patient will receive an email with your message and a link to book again on your profile.
        </p>
        <label htmlFor="decline-request-reason" className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-400">
          Reason for the patient (required)
        </label>
        <textarea
          id="decline-request-reason"
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          disabled={submitting}
          placeholder="e.g. I am away that day. Please book another time on my profile."
          className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40"
        />
        <p className="mt-1 text-xs text-slate-500">At least {REASON_MIN} characters.</p>
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 flex-1 rounded-xl border border-slate-700 bg-slate-800 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-50"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || reason.trim().length < REASON_MIN}
            className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:pointer-events-none ${
              submitting ? "" : "disabled:opacity-60"
            }`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {submitting ? "Declining…" : "Decline & notify"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
