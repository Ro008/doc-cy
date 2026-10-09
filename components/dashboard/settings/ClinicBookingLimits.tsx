"use client";

import * as React from "react";
import {
  BOOKING_HORIZON_OPTIONS_DAYS,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_MIN_NOTICE_HOURS,
  MIN_NOTICE_OPTIONS_HOURS,
} from "@/lib/doctor-settings";
import { PATIENT_CANCEL_NOTICE_CHOICES, parsePatientCancelNoticeHours } from "@/lib/patient-cancel-window";
import { SETTINGS_LINK_CLASS } from "@/components/dashboard/settings/styles";
import { PER_CLINIC_LIMITS_PENDING, type ClinicLimits } from "@/lib/settings-clinic-limits";

const SELECT_CLASS =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60 disabled:opacity-60";

const HORIZON_LABELS: Record<number, string> = { 14: "2 weeks", 30: "1 month", 90: "3 months", 180: "6 months" };
const NOTICE_LABELS: Record<number, string> = {
  1: "1 hour",
  2: "2 hours",
  4: "4 hours",
  12: "12 hours",
  24: "24 hours (1 day)",
  48: "2 days",
  72: "3 days",
  168: "1 week",
};

/**
 * One clinic's booking limits (user, 2026-10-09). Each select saves at once, like the
 * other small controls; "Apply to all my clinics" copies them to every other clinic.
 */
export function ClinicBookingLimits({
  clinicId,
  limits,
  onChange,
  clinicCount,
  sharedByAll,
  onApplyToAll,
  perClinicSaved,
  busy,
}: {
  clinicId: string;
  limits: ClinicLimits;
  onChange: (patch: Partial<ClinicLimits>) => void;
  clinicCount: number;
  /** Every clinic already has these limits. */
  sharedByAll: boolean;
  onApplyToAll: () => void;
  /** false until the backend stores limits per clinic (lib/settings-clinic-limits). */
  perClinicSaved: boolean;
  busy: boolean;
}) {
  const id = (field: string) => `${field}-${clinicId}`;
  return (
    // Part of the clinic card, not a box inside it (user, 2026-10-09: it felt cramped).
    <div className="mb-2 mt-6 border-t border-white/10 pt-6" data-testid="clinic-booking-limits">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Booking limits</p>
      <div className="mt-4 grid gap-6 sm:grid-cols-3 sm:gap-5">
        <div>
          <label htmlFor={id("bookingHorizonDays")} className="text-sm font-semibold text-slate-100">
            How far ahead
          </label>
          <p className="mt-0.5 text-xs text-slate-400">How far in advance patients can book.</p>
          <select
            id={id("bookingHorizonDays")}
            value={limits.bookingHorizonDays}
            disabled={busy}
            onChange={(e) => {
              const picked = Number(e.target.value);
              onChange({
                bookingHorizonDays: BOOKING_HORIZON_OPTIONS_DAYS.includes(
                  picked as (typeof BOOKING_HORIZON_OPTIONS_DAYS)[number],
                )
                  ? picked
                  : DEFAULT_BOOKING_HORIZON_DAYS,
              });
            }}
            className={SELECT_CLASS}
          >
            {BOOKING_HORIZON_OPTIONS_DAYS.map((days) => (
              <option key={days} value={days}>
                {HORIZON_LABELS[days] ?? `${days} days`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("minimumNoticeHours")} className="text-sm font-semibold text-slate-100">
            Minimum notice
          </label>
          <p className="mt-0.5 text-xs text-slate-400">Slots closer than this are hidden.</p>
          <select
            id={id("minimumNoticeHours")}
            value={limits.minimumNoticeHours}
            disabled={busy}
            onChange={(e) => {
              const picked = Number(e.target.value);
              onChange({
                minimumNoticeHours: MIN_NOTICE_OPTIONS_HOURS.includes(
                  picked as (typeof MIN_NOTICE_OPTIONS_HOURS)[number],
                )
                  ? picked
                  : DEFAULT_MIN_NOTICE_HOURS,
              });
            }}
            className={SELECT_CLASS}
          >
            {MIN_NOTICE_OPTIONS_HOURS.map((hours) => (
              <option key={hours} value={hours}>
                {NOTICE_LABELS[hours] ?? `${hours} hours`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("patientCancelNoticeHours")} className="text-sm font-semibold text-slate-100">
            Online cancellation
          </label>
          <p className="mt-0.5 text-xs text-slate-400">After it, patients see the clinic&apos;s phone.</p>
          <select
            id={id("patientCancelNoticeHours")}
            value={limits.patientCancelNoticeHours}
            disabled={busy}
            onChange={(e) => onChange({ patientCancelNoticeHours: parsePatientCancelNoticeHours(e.target.value) })}
            className={SELECT_CLASS}
          >
            {PATIENT_CANCEL_NOTICE_CHOICES.map((hours) => (
              <option key={hours} value={hours}>
                Up to {hours} h before
              </option>
            ))}
          </select>
        </div>
      </div>
      {clinicCount > 1 ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-xs leading-relaxed text-slate-400" data-testid="clinic-limits-scope">
            {sharedByAll
              ? `All ${clinicCount} of your clinics use these limits.`
              : "Only for this clinic. Your other clinics keep their own limits."}
          </p>
          <button
            type="button"
            onClick={onApplyToAll}
            disabled={busy}
            data-testid="clinic-limits-apply-all"
            className={`self-start whitespace-nowrap sm:self-auto ${SETTINGS_LINK_CLASS}`}
          >
            Apply to all my clinics
          </button>
        </div>
      ) : null}
      {!perClinicSaved && clinicCount > 1 ? (
        <p className="mt-4 text-xs leading-relaxed text-amber-200/80" data-testid="clinic-limits-pending">
          {PER_CLINIC_LIMITS_PENDING}
        </p>
      ) : null}
    </div>
  );
}
