"use client";

import * as React from "react";
import { toast } from "sonner";
import { SettingsSwitch } from "@/components/dashboard/settings/SettingsSwitch";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_ROW_CLASS,
} from "@/components/dashboard/settings/styles";
import { settingsActionErrorMessage } from "@/lib/settings-backend-pending";
import {
  NOTIFICATION_EMAILS,
  PATIENT_REMINDER_OPTIONS,
  validateExtraEmail,
  type NotificationSettings,
} from "@/lib/settings-notifications";

/**
 * Settings → Notifications (user, 2026-10-01; lib/settings-notifications.ts). Switches
 * and the reminder timing save at once; the second address has its own Save. Every
 * save sends the whole settings to PUT /api/doctor-notification-settings.
 */
export function NotificationsSection({
  accountEmail,
  initial,
}: {
  accountEmail: string;
  initial: NotificationSettings;
}) {
  const [saved, setSaved] = React.useState(initial);
  const [settings, setSettings] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [extraError, setExtraError] = React.useState<string | null>(null);

  /** Saves `next`; on failure the switches go back to what was saved. */
  async function save(next: NotificationSettings, successText: string): Promise<boolean> {
    setSettings(next);
    setBusy(true);
    try {
      // EXPECTED TO FAIL until Livio builds PUT /api/doctor-notification-settings
      // (backend pending, see lib/settings-backend-pending.ts): the doctor sees a message saying so.
      const res = await fetch("/api/doctor-notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          settingsActionErrorMessage("notificationSettings", res.status, data, "Could not save your notifications."),
          { id: "notifications" },
        );
        setSettings(saved);
        return false;
      }
      setSaved(next);
      toast.success(successText, { id: "notifications" });
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Could not save your notifications.", { id: "notifications" });
      setSettings(saved);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const extraDirty = settings.extraEmail.trim() !== saved.extraEmail.trim();

  return (
    <div className="space-y-5">
      <section className={SETTINGS_CARD_CLASS} data-testid="settings-notification-emails">
        <h2 className={SETTINGS_EYEBROW_CLASS}>Emails to you</h2>
        <div className="mt-4 divide-y divide-slate-800">
          {NOTIFICATION_EMAILS.map((email) => (
            <div key={email.key} className={SETTINGS_ROW_CLASS}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">{email.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{email.hint}</p>
              </div>
              <SettingsSwitch
                label={email.label}
                checked={settings.emails[email.key]}
                busy={busy}
                onChange={(on) =>
                  void save(
                    { ...settings, emails: { ...settings.emails, [email.key]: on } },
                    `${email.label}: ${on ? "on" : "off"}.`,
                  )
                }
              />
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">Security emails, like a new sign-in, always arrive.</p>
      </section>

      <section className={SETTINGS_CARD_CLASS} data-testid="settings-notification-addresses">
        <h2 className={SETTINGS_EYEBROW_CLASS}>Where they go</h2>
        <p className="mt-3 text-sm text-slate-300">
          To <span className="font-semibold text-slate-100">{accountEmail}</span>
        </p>
        <label htmlFor="notification-extra-email" className="mt-4 block text-sm font-semibold text-slate-100">
          Also send to
        </label>
        <p className="mt-0.5 text-xs text-slate-400">Optional, e.g. your reception. Leave empty to turn it off.</p>
        <input
          id="notification-extra-email"
          type="email"
          autoComplete="email"
          value={settings.extraEmail}
          onChange={(e) => {
            setSettings({ ...settings, extraEmail: e.target.value });
            if (extraError) setExtraError(null);
          }}
          aria-invalid={extraError ? true : undefined}
          placeholder="reception@yourclinic.com"
          className={`mt-2 w-full rounded-xl border bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:ring-2 ${
            extraError
              ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/25"
              : "border-slate-700 focus:border-clinical-400/60 focus:ring-clinical-400/30"
          }`}
        />
        {extraError ? (
          <p className="mt-1.5 text-xs font-medium text-red-300" role="alert">
            {extraError}
          </p>
        ) : null}
        {extraDirty ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="settings-notification-extra-save"
              disabled={busy}
              onClick={() => {
                const invalid = validateExtraEmail(settings.extraEmail, accountEmail);
                if (invalid) {
                  setExtraError(invalid);
                  return;
                }
                const extraEmail = settings.extraEmail.trim();
                void save({ ...settings, extraEmail }, extraEmail ? `Emails also go to ${extraEmail}.` : "Second address removed.");
              }}
              className="inline-flex h-9 items-center rounded-xl bg-clinical-500 px-3.5 text-sm font-semibold text-ink-900 transition hover:bg-clinical-400 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save address"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSettings({ ...settings, extraEmail: saved.extraEmail });
                setExtraError(null);
              }}
              className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-medium text-slate-300 transition hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </section>

      <section className={SETTINGS_CARD_CLASS} data-testid="settings-notification-reminders">
        <h2 className={SETTINGS_EYEBROW_CLASS}>Reminders to patients</h2>
        <div className="mt-4 divide-y divide-slate-800">
          <div className={SETTINGS_ROW_CLASS}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">Remind patients of their visit</p>
              <p className="mt-0.5 text-xs text-slate-400">An email before each confirmed appointment.</p>
            </div>
            <SettingsSwitch
              label="Remind patients of their visit"
              checked={settings.patientReminder.enabled}
              busy={busy}
              onChange={(on) =>
                void save(
                  { ...settings, patientReminder: { ...settings.patientReminder, enabled: on } },
                  on ? "Patients get a reminder." : "Patient reminders off.",
                )
              }
            />
          </div>
          {settings.patientReminder.enabled ? (
            <div className={SETTINGS_ROW_CLASS}>
              <label htmlFor="notification-reminder-when" className="text-sm font-semibold text-slate-100">
                When
              </label>
              <select
                id="notification-reminder-when"
                value={settings.patientReminder.hoursBefore}
                disabled={busy}
                onChange={(e) => {
                  const hoursBefore = Number(e.target.value) === 2 ? 2 : 24;
                  void save(
                    { ...settings, patientReminder: { ...settings.patientReminder, hoursBefore } },
                    "Reminder time saved.",
                  );
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-clinical-400/60 focus:ring-2 focus:ring-clinical-400/30 sm:w-56"
              >
                {PATIENT_REMINDER_OPTIONS.map((option) => (
                  <option key={option.hours} value={option.hours}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
