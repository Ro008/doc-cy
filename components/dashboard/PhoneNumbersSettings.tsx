"use client";

import * as React from "react";
import { settingsSectionHref } from "@/lib/settings-sections";
import { SETTINGS_CARD_CLASS, SETTINGS_EYEBROW_CLASS } from "@/components/dashboard/settings/styles";
import type { SettingsClinicPhone } from "@/lib/settings-clinic-phones";

type PhoneNumbersSettingsProps = {
  mobileNumber: string;
  onMobileNumberChange: (value: string) => void;
  clinicPhones: readonly SettingsClinicPhone[];
  /** Switches settings to the Clinics section (no page load). */
  onOpenClinics?: () => void;
};

/**
 * Phone numbers on the settings page (user, 2026-09-29). Patients see each clinic's
 * phone on the public Call buttons, whether or not the clinic takes online bookings.
 * Clinics are curated by DocCy, so their phones are read-only here; one way to change
 * them, "Request a change" on the clinic's card in Clinics (user, 2026-10-01). The mobile
 * is the account's own number and is not shown to patients.
 */
export function PhoneNumbersSettings({
  mobileNumber,
  onMobileNumberChange,
  clinicPhones,
  onOpenClinics,
}: PhoneNumbersSettingsProps) {
  return (
    <section id="phone-numbers" className={`scroll-mt-24 ${SETTINGS_CARD_CLASS}`}>
      <h2 className={SETTINGS_EYEBROW_CLASS}>Phone numbers</h2>

      <div className="mt-4 divide-y divide-slate-800">
        <div className="pb-5">
          <label htmlFor="mobileNumber" className="text-sm font-semibold text-slate-100">
            Mobile
          </label>
          <p className="mt-0.5 text-xs text-slate-400">
            Your DocCy account number. Patients don&apos;t see it.
          </p>
          <input
            id="mobileNumber"
            type="tel"
            autoComplete="tel"
            value={mobileNumber}
            onChange={(e) => onMobileNumberChange(e.target.value)}
            placeholder="+357..."
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-clinical-400/60 focus:ring-2 focus:ring-clinical-400/30"
          />
        </div>

        <div data-testid="settings-clinic-phones" className="pt-5">
          <p className="text-sm font-semibold text-slate-100">
            {clinicPhones.length === 1 ? "Clinic phone" : "Clinic phones"}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Patients can call this number from your profile and your listing in Health
            Finder.
          </p>
          {clinicPhones.length > 0 ? (
            <ul className="mt-3 divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-950/40">
              {clinicPhones.map((clinic) => (
                <li
                  key={clinic.clinicId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3"
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
            To change a clinic’s phone, go to{" "}
            <a
              href={settingsSectionHref("clinics")}
              // A section link, so the unsaved-changes guard lets it through.
              data-settings-section="clinics"
              onClick={(event) => {
                if (!onOpenClinics) return;
                event.preventDefault();
                onOpenClinics();
              }}
              className="font-medium text-clinical-300 underline-offset-2 hover:text-clinical-200 hover:underline"
            >
              Clinics
            </a>{" "}
            and use Request a change.
          </p>
        </div>
      </div>
    </section>
  );
}
