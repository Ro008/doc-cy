"use client";

import * as React from "react";
import { Trash2, X } from "lucide-react";
import { WhatsAppLogoIcon } from "@/components/icons/WhatsAppLogoIcon";

export type UpcomingAppointmentItem = {
  id: string;
  patient_name: string;
  patient_phone?: string;
  dateLabel: string;
  timeLabel: string;
  whatsappUrl: string | null;
};

type UpcomingListProps = {
  items: UpcomingAppointmentItem[];
};

export function UpcomingList({ items }: UpcomingListProps) {
  const [toCancel, setToCancel] = React.useState<UpcomingAppointmentItem | null>(
    null
  );
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleConfirmCancel() {
    if (!toCancel) return;
    setError(null);
    try {
      setIsCancelling(true);
      const res = await fetch(`/api/appointments/${toCancel.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.message || "We could not cancel this appointment."
        );
        return;
      }
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <ul className="mt-4 overflow-hidden rounded-xl border border-slate-800/60">
        {items.map((r, i) => (
          <li
            key={r.id}
            className={`group flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-slate-800/40 ${
              i % 2 === 0 ? "bg-slate-900/50" : "bg-slate-800/30"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-100">
                {r.patient_name}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                {r.dateLabel} · {r.timeLabel}
              </p>
            </div>

            {/* Actions (WhatsApp + Cancel). Low opacity on desktop, always visible on mobile. */}
            <div className="flex shrink-0 items-center gap-2 opacity-100 md:opacity-20 md:group-hover:opacity-100 transition-opacity">
              <a
                href={r.whatsappUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                title="Chat on WhatsApp"
                aria-label="Chat on WhatsApp"
                onClick={(e) => {
                  if (!r.whatsappUrl) e.preventDefault();
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 transition hover:bg-emerald-400/20 hover:border-emerald-400/40 md:h-8 md:w-8"
              >
                <WhatsAppLogoIcon className="h-4 w-4 md:h-4 md:w-4" />
              </a>

              <button
                type="button"
                onClick={() => setToCancel(r)}
                title="Cancel Appointment"
                aria-label="Cancel"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 hover:border-red-500/50 md:h-8 md:w-8 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Cancel</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {toCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          <button
            type="button"
            onClick={() => {
              setToCancel(null);
              setError(null);
            }}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-emerald-100/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => {
                setToCancel(null);
                setError(null);
              }}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="pr-8 text-base font-semibold text-slate-50">
              Cancel appointment
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              {toCancel.patient_name}
            </p>
            <p className="mt-1 text-xs font-mono text-slate-400">
              {toCancel.dateLabel} · {toCancel.timeLabel}
            </p>
            <p className="mt-4 text-xs text-slate-400">
              This will free the time slot so another patient can book it.
            </p>
            {error && (
              <p className="mt-3 text-xs text-red-300">{error}</p>
            )}
            <div className="mt-5 flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setToCancel(null);
                  setError(null);
                }}
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Keep appointment
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 shadow-sm transition hover:border-red-400/60 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCancelling ? "Cancelling..." : "Confirm cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

