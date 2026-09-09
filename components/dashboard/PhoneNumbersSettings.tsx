"use client";

import * as React from "react";
import { formatCyprusPhoneDisplay } from "@/lib/phone-link";
import {
  callNumberForSource,
  hasDistinctDirectoryPhone,
  type PublicPhoneSource,
} from "@/lib/public-call-phone";

type PhoneNumbersSettingsProps = {
  mobileNumber: string;
  onMobileNumberChange: (value: string) => void;
  clinicPhone: string;
  onClinicPhoneChange: (value: string) => void;
  clinicRowVisible: boolean;
  onAddClinicPhone: () => void;
  onRemoveClinicPhone: () => void;
  showPhonePublic: boolean;
  onShowPhonePublicChange: (value: boolean) => void;
  publicPhoneSource: PublicPhoneSource;
  onPublicPhoneSourceChange: (value: PublicPhoneSource) => void;
  saving?: boolean;
};

function PhoneSwitch({
  checked,
  onChange,
  disabled,
  busy,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
}) {
  const switchId = React.useId();
  return (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-clinical-500/90" : "bg-slate-600"
      }`}
    >
      <span
        className={`absolute left-0.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
          checked ? "translate-x-[1.125rem]" : "translate-x-0"
        }`}
        aria-hidden
      />
    </button>
  );
}

function NumberRow({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  showChooser,
  selectedForCall,
  shownOnProfile,
  onSelectForCall,
  onRemove,
  chooserDisabled = false,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showChooser: boolean;
  selectedForCall: boolean;
  shownOnProfile: boolean;
  onSelectForCall: () => void;
  onRemove?: () => void;
  chooserDisabled?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-ink-900/35 p-3 ${
        shownOnProfile || (showChooser && selectedForCall)
          ? "border-clinical-500/50"
          : "border-slate-800/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-100">
          {label}
        </label>
        <div className="flex shrink-0 items-center gap-2">
          {shownOnProfile ? (
            <span className="rounded-full bg-clinical-500/15 px-2 py-0.5 text-[11px] font-semibold text-clinical-200">
              Shown on Call
            </span>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <input
        id={id}
        type="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
      />
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
      {showChooser ? (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input
            type="radio"
            name="public-call-number"
            checked={selectedForCall}
            onChange={onSelectForCall}
            disabled={chooserDisabled}
            className="h-4 w-4 border-slate-600 bg-slate-900 text-clinical-500 focus:ring-clinical-400/60 disabled:opacity-50"
          />
          Use this number for Call
        </label>
      ) : null}
    </div>
  );
}

export function PhoneNumbersSettings({
  mobileNumber,
  onMobileNumberChange,
  clinicPhone,
  onClinicPhoneChange,
  clinicRowVisible,
  onAddClinicPhone,
  onRemoveClinicPhone,
  showPhonePublic,
  onShowPhonePublicChange,
  publicPhoneSource,
  onPublicPhoneSourceChange,
  saving = false,
}: PhoneNumbersSettingsProps) {
  const twoNumbers = hasDistinctDirectoryPhone(mobileNumber, clinicPhone);
  const showChooser = twoNumbers && clinicRowVisible;
  const activeSource = showChooser
    ? publicPhoneSource
    : inferCollapsedSource(mobileNumber, clinicPhone);
  const selectedNumber = callNumberForSource({
    source: activeSource,
    mobileNumber,
    directoryPhone: clinicPhone,
  });
  const callReady = selectedNumber.length > 0;
  const callIsOn = showPhonePublic && callReady;
  const callNumberLabel = formatCyprusPhoneDisplay(selectedNumber);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Phone numbers
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Patients book online by default. The Call button can show one number on
        your public profile.
      </p>

      <div className="mt-4 space-y-3">
        <NumberRow
          id="mobileNumber"
          label="Mobile"
          hint="Your DocCy account number."
          value={mobileNumber}
          onChange={onMobileNumberChange}
          placeholder="+357..."
          showChooser={showChooser}
          selectedForCall={activeSource === "mobile"}
          shownOnProfile={callIsOn && activeSource === "mobile"}
          onSelectForCall={() => onPublicPhoneSourceChange("mobile")}
          chooserDisabled={saving}
        />
        {clinicRowVisible ? (
          <NumberRow
            id="clinicPhone"
            label="Clinic"
            hint="Landline or listing number, if it is different."
            value={clinicPhone}
            onChange={onClinicPhoneChange}
            placeholder="+357..."
            showChooser={showChooser}
            selectedForCall={activeSource === "directory"}
            shownOnProfile={callIsOn && activeSource === "directory"}
            onSelectForCall={() => onPublicPhoneSourceChange("directory")}
            onRemove={onRemoveClinicPhone}
            chooserDisabled={saving}
          />
        ) : (
          <button
            type="button"
            onClick={onAddClinicPhone}
            className="text-sm font-medium text-clinical-300 hover:text-clinical-200"
          >
            Add a clinic phone
          </button>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-700/80 bg-ink-900/35 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100">
              Show a Call button on my profile
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {!callReady
                ? "Add a number before patients can call you."
                : callIsOn
                  ? `Patients can call ${callNumberLabel}.`
                  : "Keep this off to encourage online bookings and reduce direct calls."}
            </p>
            <p className="mt-1 text-xs text-slate-500">Saves immediately.</p>
          </div>
          <PhoneSwitch
            checked={callIsOn}
            disabled={!callReady || saving}
            busy={saving}
            onChange={(next) => {
              if (next && !callReady) return;
              onShowPhonePublicChange(next);
            }}
            label={
              callIsOn
                ? `Show a Call button on my profile with ${callNumberLabel}`
                : "Show a Call button on my profile"
            }
          />
        </div>
      </div>
    </div>
  );
}

function inferCollapsedSource(
  mobileNumber: string,
  clinicPhone: string,
): PublicPhoneSource {
  if (clinicPhone.trim() && !mobileNumber.trim()) return "directory";
  return "mobile";
}
