"use client";

import * as React from "react";
import { emitOpenFeedback } from "@/lib/doccy-feedback";
import type { SettingsClinicPhone } from "@/lib/settings-clinic-phones";

type PhoneNumbersSettingsProps = {
  mobileNumber: string;
  onMobileNumberChange: (value: string) => void;
  clinicPhones: readonly SettingsClinicPhone[];
};

function clinicPhoneChangeMessage(clinicPhones: readonly SettingsClinicPhone[]): string {
  const names = clinicPhones.map((clinic) => clinic.name).filter(Boolean);
  const where = names.length === 1 ? `my clinic "${names[0]}"` : "one of my clinics";
  return `Hello, I would like to change the phone number of ${where}. The new number is: `;
}

/**
 * Phone numbers on the settings page (user, 2026-09-29). Patients see each clinic's
 * phone on the public Call buttons, whether or not the clinic takes online bookings.
 * Clinics are curated by DocCy, so their phones are read-only here. The mobile is the
 * account's own number and is not shown to patients.
 */
export function PhoneNumbersSettings({
  mobileNumber,
  onMobileNumberChange,
  clinicPhones,
}: PhoneNumbersSettingsProps) {
  return (
    <div
      id="phone-numbers"
      className="scroll-mt-24 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Phone numbers
      </p>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-slate-800/80 bg-ink-900/35 p-3">
          <label htmlFor="mobileNumber" className="text-sm font-medium text-slate-100">
            Mobile
          </label>
          <input
            id="mobileNumber"
            type="tel"
            autoComplete="tel"
            value={mobileNumber}
            onChange={(e) => onMobileNumberChange(e.target.value)}
            placeholder="+357..."
            className="mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
          />
          <p className="mt-2 text-xs text-slate-400">
            Your DocCy account number. Patients don&apos;t see it.
          </p>
        </div>

        <div
          data-testid="settings-clinic-phones"
          className="rounded-xl border border-slate-800/80 bg-ink-900/35 p-3"
        >
          <p className="text-sm font-medium text-slate-100">
            {clinicPhones.length === 1 ? "Clinic phone" : "Clinic phones"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Patients can call this number from your profile and your listing in Health
            Finder.
          </p>
          {clinicPhones.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {clinicPhones.map((clinic) => (
                <li
                  key={clinic.clinicId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-slate-800/80 bg-ink-900/40 px-3 py-2"
                >
                  <span className="text-sm text-slate-200">{clinic.name || "Clinic"}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-100">
                    {clinic.phone || "No phone yet"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-300">No clinic yet.</p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            To change a clinic&apos;s phone,{" "}
            <button
              type="button"
              data-testid="settings-clinic-phone-contact"
              onClick={() =>
                emitOpenFeedback({
                  subject: "General Question",
                  message: clinicPhoneChangeMessage(clinicPhones),
                })
              }
              className="font-medium text-clinical-300 underline-offset-2 hover:text-clinical-200 hover:underline"
            >
              contact us
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
