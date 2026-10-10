"use client";

import * as React from "react";
import { toast } from "sonner";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import { SettingsSwitch } from "@/components/dashboard/settings/SettingsSwitch";
import { CountryCodePicker } from "@/components/dashboard/settings/CountryCodePicker";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_GHOST_BUTTON_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import {
  composeRegisterPhone,
  isValidRegisterMobile,
  registerMobileExample,
  registerPhoneDialCode,
  registerPhoneCountries,
  registerPhoneCountryName,
  splitRegisterPhone,
  type RegisterPhoneCountry,
} from "@/lib/register-phone";

/**
 * Settings → Account, personal mobile (user, 2026-10-09; in Account since 2026-10-10:
 * it is DocCy's way to reach her and a future SMS sign-in factor). She changes it with its own
 * Save (a real mobile for the chosen country, as on /register) and decides with a
 * switch, saved at once, whether patients see it on her profile. Both changes are
 * recorded for DocCy (request_log, no approval). The clinic phone stays the main
 * number patients call.
 */
export function PersonalMobileCard({
  initialMobile,
  initialShowOnProfile,
}: {
  initialMobile: string;
  initialShowOnProfile: boolean;
}) {
  const [saved, setSaved] = React.useState(initialMobile);
  const start = splitRegisterPhone(initialMobile);
  const [country, setCountry] = React.useState(start.country);
  const [typed, setTyped] = React.useState(start.national);
  // Country names come from Intl, which differs between Node and browsers: render only
  // the chosen country on the server (see RegisterPhoneField).
  const [countries, setCountries] = React.useState<RegisterPhoneCountry[]>([]);
  React.useEffect(() => setCountries(registerPhoneCountries()), []);
  const [saving, setSaving] = React.useState(false);
  const [show, setShow] = React.useState(initialShowOnProfile);
  const [showSaving, setShowSaving] = React.useState(false);

  const { e164 } = composeRegisterPhone(country, typed);
  const valid = isValidRegisterMobile(e164);
  const dirty = e164 !== saved;
  const options: RegisterPhoneCountry[] =
    countries.length > 0
      ? countries
      : [{ code: country, name: registerPhoneCountryName(country), dialCode: registerPhoneDialCode(country) }];
  const dialCode = registerPhoneDialCode(country);
  const example = registerMobileExample(country);

  const onNumberChange = (value: string) => {
    // A full international number (typed or pasted) picks its own country.
    if (value.trim().startsWith("+")) {
      const next = composeRegisterPhone(country, value);
      const nextDial = registerPhoneDialCode(next.country);
      if (nextDial && next.e164.startsWith(nextDial) && next.e164.length > nextDial.length) {
        setCountry(next.country);
        setTyped(next.e164.slice(nextDial.length));
        return;
      }
    }
    setTyped(value);
  };

  const reset = () => {
    const back = splitRegisterPhone(saved);
    setCountry(back.country);
    setTyped(back.national);
  };

  async function saveMobile() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/professional-mobile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: e164 }),
      });
      const data = (await res.json().catch(() => ({}))) as { mobile?: string; message?: string };
      if (!res.ok || !data.mobile) {
        toast.error(data.message ?? "Could not save your mobile.");
        return;
      }
      setSaved(data.mobile);
      toast.success("Mobile saved.");
    } catch {
      toast.error("Could not save your mobile.");
    } finally {
      setSaving(false);
    }
  }

  async function changeShow(next: boolean) {
    if (showSaving) return;
    setShow(next);
    setShowSaving(true);
    try {
      const res = await fetch("/api/professional-mobile/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setShow(!next);
        toast.error(data.message ?? "Could not save.");
        return;
      }
      toast.success(next ? "Your mobile shows on your profile." : "Your mobile is hidden from patients.");
    } catch {
      setShow(!next);
      toast.error("Could not save.");
    } finally {
      setShowSaving(false);
    }
  }

  return (
    <section data-testid="settings-personal-mobile" className={SETTINGS_CARD_CLASS}>
      <label htmlFor="settings-personal-mobile" className={SETTINGS_EYEBROW_CLASS}>
        Personal mobile
      </label>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Your own number for DocCy. Patients call your clinic&apos;s phone; they only see this
        one if you turn it on below.
      </p>
      <div className="mt-2 flex rounded-xl border border-slate-700 bg-slate-950/60 transition focus-within:border-clinical-400/60 focus-within:ring-2 focus-within:ring-clinical-400/30">
        <CountryCodePicker countries={options} value={country} onChange={setCountry} disabled={saving} />
        <input
          id="settings-personal-mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label="Mobile number"
          value={typed}
          onChange={(event) => onNumberChange(event.target.value)}
          readOnly={saving}
          aria-busy={saving}
          aria-invalid={dirty && !valid}
          placeholder={example && dialCode ? example.replace(`${dialCode} `, "") : ""}
          className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </div>
      {dirty && !valid ? (
        <p className="mt-1.5 text-xs font-medium text-red-300" role="alert">
          Enter a valid {registerPhoneCountryName(country)} mobile number
          {example ? `, e.g. ${example}` : ""}.
        </p>
      ) : null}
      {dirty ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!valid || saving}
            aria-busy={saving}
            onClick={() => void saveMobile()}
            className={`${SETTINGS_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <BusyLabel busy={saving} busyText="Saving…">
              Save mobile
            </BusyLabel>
          </button>
          <button type="button" disabled={saving} onClick={reset} className={SETTINGS_GHOST_BUTTON_CLASS}>
            Cancel
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex items-start justify-between gap-4 border-t border-slate-800 pt-4">
        <div>
          <p className="text-sm font-semibold text-slate-100">Show on my profile</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {saved ? "Let patients see your mobile on your public profile." : "Save your mobile first."}
          </p>
        </div>
        <SettingsSwitch
          checked={show}
          onChange={(next) => void changeShow(next)}
          label="Show on my profile"
          busy={showSaving}
          disabled={!saved && !show}
        />
      </div>
    </section>
  );
}
