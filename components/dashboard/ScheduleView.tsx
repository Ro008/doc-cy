"use client";

import * as React from "react";
import { X, Trash2 } from "lucide-react";

export type ScheduleAppointment = {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  whatsappUrl: string | null;
  timeLabel: string;
  minutesFrom8: number;
};

function getWhatsAppUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function ScheduleView({
  appointments,
}: {
  appointments: ScheduleAppointment[];
}) {
  const [selected, setSelected] = React.useState<ScheduleAppointment | null>(
    null
  );
  const [confirmingCancel, setConfirmingCancel] =
    React.useState<boolean>(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const isEmpty = appointments.length === 0;
  const sortedAppointments = React.useMemo(
    () =>
      [...appointments].sort(
        (a, b) => a.minutesFrom8 - b.minutesFrom8
      ),
    [appointments]
  );

  async function handleCancelAppointment() {
    if (!selected) return;
    setCancelError(null);
    try {
      setIsCancelling(true);
      const res = await fetch(`/api/appointments/${selected.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCancelError(
          data?.message || "We could not cancel this appointment."
        );
        return;
      }
      // Simple approach for MVP + E2E: reload to refresh timeline.
      window.location.reload();
    } catch (err) {
      console.error(err);
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      {/* Mobile: stacked vertical list — no timeline grid, no overlapping */}
      <div className="md:hidden">
        {isEmpty ? (
          <p className="py-4 text-center text-sm text-slate-500">
            No appointments today
          </p>
        ) : (
          <ul className="space-y-2">
            {appointments.map((appt) => (
              <li key={appt.id}>
                <button
                  type="button"
                  onClick={() => setSelected(appt)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-3 text-left transition hover:border-emerald-400/30 hover:bg-emerald-400/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                >
                  <span
                    className="shrink-0 font-mono text-sm font-medium text-slate-400"
                    style={{ minWidth: "3rem" }}
                  >
                    {appt.timeLabel}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                    {appt.patient_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Desktop: when no appointments, compact empty state */}
      {isEmpty && (
        <div className="hidden py-6 text-center md:block">
          <p className="text-sm text-slate-500">
            No appointments today — schedule is clear
          </p>
        </div>
      )}

      {/* Desktop: stacked list with clear separation (no overlapping) */}
      {!isEmpty && (
        <div className="hidden flex-col gap-2 md:flex">
          {sortedAppointments.map((appt) => (
            <button
              key={appt.id}
              type="button"
              onClick={() => setSelected(appt)}
              className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-slate-900/60 px-4 py-3 text-left shadow-sm transition hover:border-emerald-400/50 hover:bg-emerald-400/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            >
              <span className="shrink-0 font-mono text-xs font-semibold text-slate-400">
                {appt.timeLabel}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {appt.patient_name}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {appt.patient_email || appt.patient_phone}
                </p>
              </div>
              {/* Calendar sync removed for demo simplicity */}
            </button>
          ))}
        </div>
      )}

      {/* Detail modal — overlay only; z-index kept for accessibility */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-emerald-100/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="pr-8 text-lg font-semibold text-slate-50">
              {selected.patient_name}
            </h3>
            <p className="mt-1 text-sm text-slate-400">{selected.timeLabel}</p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-slate-200">
                <span className="text-slate-400">Phone</span>{" "}
                {selected.patient_phone}
              </p>
              <p className="text-slate-200">
                <span className="text-slate-400">Email</span>{" "}
                {selected.patient_email}
              </p>
            </div>
            <div className="mt-6">
              {(selected.whatsappUrl ?? getWhatsAppUrl(selected.patient_phone)) ? (
                <a
                  href={
                    selected.whatsappUrl ??
                    getWhatsAppUrl(selected.patient_phone) ??
                    "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
                >
                  Chat on WhatsApp
                </a>
              ) : (
                <span className="text-xs text-slate-500">
                  WhatsApp not available
                </span>
              )}
            </div>

            <div className="mt-4 border-t border-slate-800/60 pt-4">
              {!confirmingCancel ? (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-medium text-red-300 transition hover:border-red-400/40 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                >
                  <Trash2 className="h-4 w-4" />
                  Cancel appointment
                </button>
              ) : (
                <div className="space-y-3 text-xs text-slate-300">
                  <p className="text-slate-300">
                    Are you sure you want to cancel this appointment? This will
                    free the time slot for other patients.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingCancel(false);
                        setCancelError(null);
                      }}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                    >
                      Keep appointment
                    </button>
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={handleCancelAppointment}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 shadow-sm transition hover:border-red-400/60 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isCancelling ? "Cancelling..." : "Confirm cancel"}
                    </button>
                  </div>
                  {cancelError && (
                    <p className="text-xs text-red-300">{cancelError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
