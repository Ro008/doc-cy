"use client";

import * as React from "react";
import { toast } from "sonner";
import { validateClinicChangeRequest, type ClinicPick } from "@/lib/clinic-change-request";
import { CLINIC_PHONE_HINT, formatCyprusClinicPhoneInput } from "@/lib/clinic-phone";
import type { ClinicLocation } from "@/lib/clinic-location";
import { CLINIC_NAME_MAX_LENGTH, clinicChangeLines, type PendingClinicDetailsRequest } from "@/lib/clinic-requests";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import { ClinicPicker } from "@/components/dashboard/settings/ClinicPicker";
import {
  SettingsDialog,
  dialogPrimaryButtonClass,
  dialogSecondaryButtonClass,
} from "@/components/dashboard/settings/SettingsDialog";

const fieldLabelClass = "text-xs font-semibold uppercase tracking-[0.12em] text-slate-400";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-pro-line bg-pro-page/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-clinical-400/60 focus:ring-2 focus:ring-clinical-400/30";

/**
 * "Request a change to clinic details" (user, 2026-10-11): only the name, the address
 * (found on Google Maps or with a pin) and the phone of a clinic she works at. DocCy's
 * founders approve it, because the clinic is shared; one open request per clinic. Only
 * what differs is sent (POST /api/clinic-change-requests). Joining another clinic is
 * "+ Add clinic", not this dialog.
 */
export function ClinicChangeRequestDialog({
  clinicName,
  locationId,
  current,
  otherProfessionals,
  onClose,
  onSent,
}: {
  clinicName: string;
  locationId: string;
  /** The clinic as it is: name, phone as shown (+357 …) and place. */
  current: { name: string; phone: string; location: ClinicLocation };
  /** Others who work at the clinic: the change applies for them too. */
  otherProfessionals: number;
  onClose: () => void;
  onSent: (pending: PendingClinicDetailsRequest) => void;
}) {
  const nameId = React.useId();
  const phoneId = React.useId();
  const [name, setName] = React.useState(current.name);
  const [phone, setPhone] = React.useState(() => formatCyprusClinicPhoneInput(current.phone));
  const [location, setLocation] = React.useState<ClinicLocation>(current.location);
  const [busy, setBusy] = React.useState(false);
  const onPick = React.useCallback((pick: ClinicPick) => setLocation(pick.location), []);

  const asItIs = {
    name: current.name,
    address: current.location.address,
    phone: current.phone,
    latitude: current.location.latitude,
    longitude: current.location.longitude,
  };
  const check = validateClinicChangeRequest({
    current: asItIs,
    requested: { clinicId: null, name, phone, location },
  });
  const lines = check.ok ? clinicChangeLines(asItIs, check.changes) : [];
  // "Change at least one detail" is not a mistake to point at: the button just waits.
  const problem = check.ok === false && check.field !== null ? check.message : null;

  async function send(close: () => void) {
    if (check.ok === false) return;
    setBusy(true);
    try {
      const res = await fetch("/api/clinic-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, changes: check.changes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.message === "string" && data.message ? data.message : "Could not send the request.");
        return;
      }
      const { name: newName, address, phone: newPhone } = check.changes;
      onSent({
        id: String(data?.request?.id ?? ""),
        createdAt: String(data?.request?.createdAt ?? new Date().toISOString()),
        changes: {
          ...(newName ? { name: newName } : {}),
          ...(address ? { address } : {}),
          ...(newPhone ? { phone: newPhone } : {}),
        },
      });
      toast.success("Request sent. We’ll email you once DocCy has checked it.");
      close();
    } catch (err) {
      console.error(err);
      toast.error("Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsDialog
      wide
      title={`Request a change to ${clinicName}’s details`}
      description="Change the name, the address or the phone below. DocCy checks every change before patients see it, and emails you when it is done."
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <button type="button" onClick={close} disabled={busy} className={dialogSecondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send(close)}
            disabled={busy || check.ok === false}
            aria-busy={busy}
            className={`${dialogPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <BusyLabel busy={busy} busyText="Sending…">
              Send request
            </BusyLabel>
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <div>
          <label htmlFor={nameId} className={fieldLabelClass}>
            Clinic name
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            maxLength={CLINIC_NAME_MAX_LENGTH}
            readOnly={busy}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <p className={fieldLabelClass}>Address</p>
          <div className="mt-1.5">
            <ClinicPicker
              initial={{ location: current.location }}
              onChange={onPick}
              docCySearch={false}
              showDetailsFields={false}
              plainSummary
            />
          </div>
        </div>

        <div>
          <label htmlFor={phoneId} className={fieldLabelClass}>
            Clinic phone
          </label>
          <div className="mt-1.5 flex rounded-xl border border-pro-line bg-pro-page/60 transition focus-within:border-clinical-400/60 focus-within:ring-2 focus-within:ring-clinical-400/30 sm:max-w-xs">
            <span className="flex shrink-0 items-center gap-1.5 rounded-l-xl border-r border-pro-line px-3 text-sm text-slate-300">
              <span className="text-slate-400">CY</span>
              <span className="font-semibold text-slate-100">+357</span>
            </span>
            <input
              id={phoneId}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              readOnly={busy}
              onChange={(event) => {
                const value = event.target.value;
                // Regrouping moves the caret to the end: while she edits mid-number, wait for blur.
                const caretAtEnd = event.target.selectionStart === value.length;
                setPhone(caretAtEnd ? formatCyprusClinicPhoneInput(value) : value);
              }}
              onBlur={() => setPhone((value) => formatCyprusClinicPhoneInput(value))}
              placeholder="25 123456"
              className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 py-2.5 text-sm tabular-nums text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Patients call this number. {CLINIC_PHONE_HINT}</p>
        </div>

        <section
          aria-label="What you are asking for"
          data-testid="settings-clinic-change-summary"
          className="rounded-2xl border border-pro-line bg-pro-page/40 px-3.5 py-3"
        >
          <p className={fieldLabelClass}>What you are asking for</p>
          {problem ? (
            <p className="mt-2 text-sm text-rose-300" role="alert">
              {problem}
            </p>
          ) : lines.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Nothing yet: change a detail above to send a request.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {lines.map((line) => (
                <li key={line.label}>
                  <span className="font-semibold text-slate-200">{line.label}:</span>{" "}
                  <span className="text-slate-400 line-through">{line.from}</span>{" "}
                  <span className="text-clinical-100">→ {line.to}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {otherProfessionals > 0 ? (
          <p className="text-xs text-slate-400" data-testid="settings-clinic-change-shared">
            {otherProfessionals === 1
              ? "1 other professional works at this clinic: the change applies for them too."
              : `${otherProfessionals} other professionals work at this clinic: the change applies for them too.`}
          </p>
        ) : null}
      </div>
    </SettingsDialog>
  );
}
