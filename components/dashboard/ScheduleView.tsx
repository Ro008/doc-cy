"use client";

import * as React from "react";
import { X } from "lucide-react";

export type ScheduleAppointment = {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  whatsappUrl: string | null;
  timeLabel: string;
  minutesFrom8: number;
  durationMinutes: number;
};

const ROW_HEIGHT = 56;
const HOURS = 10; // 08:00 to 18:00
const TOTAL_HEIGHT = ROW_HEIGHT * HOURS;
const TIME_COLUMN_WIDTH = "4rem"; // fixed width so cards never overlap times

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

  const isEmpty = appointments.length === 0;

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

      {/* Desktop: when no appointments, compact empty state (no huge timeline) */}
      {isEmpty && (
        <div className="hidden py-6 text-center md:block">
          <p className="text-sm text-slate-500">
            No appointments today — schedule is clear
          </p>
        </div>
      )}

      {/* Desktop: timeline grid only when there are appointments */}
      {!isEmpty && (
        <div
          className="relative hidden md:grid"
          style={{
            gridTemplateColumns: `${TIME_COLUMN_WIDTH} 1fr`,
            gridTemplateRows: "auto",
            minHeight: TOTAL_HEIGHT,
          }}
        >
          {/* Column 1: time labels — fixed width, never overlapped */}
          <div
            className="flex flex-col border-r border-slate-800/80 pr-2"
            style={{ height: TOTAL_HEIGHT }}
          >
            {Array.from({ length: HOURS + 1 }, (_, i) => 8 + i).map((h) => (
              <div
                key={h}
                className="flex items-start justify-end font-mono text-xs text-slate-400"
                style={{ height: ROW_HEIGHT }}
              >
                {h.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Column 2: timeline grid lines + appointment cards */}
          <div
            className="relative border-slate-800/50"
            style={{ height: TOTAL_HEIGHT }}
          >
            {/* Hour grid lines */}
            {Array.from({ length: HOURS }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-b border-slate-800/50"
                style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
              />
            ))}

            {/* Appointment blocks — positioned inside column 2 only */}
            {appointments.map((appt) => {
              const top = (appt.minutesFrom8 / 60) * ROW_HEIGHT;
              const height = Math.max(
                32,
                (appt.durationMinutes / 60) * ROW_HEIGHT
              );
              return (
                <button
                  key={appt.id}
                  type="button"
                  onClick={() => setSelected(appt)}
                  className="absolute left-2 right-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-left shadow-sm transition hover:border-emerald-400/50 hover:bg-emerald-400/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  style={{ top: `${top}px`, height: `${height}px` }}
                >
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {appt.patient_name}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {appt.timeLabel}
                  </span>
                </button>
              );
            })}
          </div>
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
          </div>
        </div>
      )}
    </>
  );
}
