"use client";

import * as React from "react";
import { settingsSectionHref } from "@/lib/settings-sections";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_INLINE_LINK_CLASS,
} from "@/components/dashboard/settings/styles";
import type { SettingsClinicPhone } from "@/lib/settings-clinic-phones";

type PhoneNumbersSettingsProps = {
  clinicPhones: readonly SettingsClinicPhone[];
  /** Switches settings to the Clinics section (no page load). */
  onOpenClinics?: () => void;
};

/**
 * Phone numbers on the settings page (user, 2026-09-29). Patients see each clinic's
 * phone on the public Call buttons, whether or not the clinic takes online bookings.
 * Clinics are curated by DocCy, so their phones are read-only here; one way to change
 * them, "Request a change" on the clinic's card in Clinics (user, 2026-10-01). The
 * personal mobile moved to Profile (PersonalMobileCard, user 2026-10-09); the clinic
 * phones are to move onto each clinic card, and then this section goes.
 */
export function PhoneNumbersSettings({
  clinicPhones,
  onOpenClinics,
}: PhoneNumbersSettingsProps) {
  return (
    <section id="phone-numbers" className={`scroll-mt-24 ${SETTINGS_CARD_CLASS}`}>
      <h2 className={SETTINGS_EYEBROW_CLASS}>Phone numbers</h2>

      <div className="mt-4">
        <div data-testid="settings-clinic-phones">
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
              className={SETTINGS_INLINE_LINK_CLASS}
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
