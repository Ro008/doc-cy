"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import type { PendingClinicChange } from "@/components/dashboard/settings/ClinicChangeRequestDialog";
import {
  SETTINGS_GHOST_BUTTON_CLASS,
  SETTINGS_LINK_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import {
  CLINIC_PHONE_HINT,
  formatCyprusClinicPhoneInput,
  normalizeCyprusClinicPhone,
} from "@/lib/clinic-phone";
import { settingsActionErrorMessage } from "@/lib/settings-backend-pending";

/**
 * The phone on a clinic card (Settings → Clinics, user 2026-10-10): the number patients
 * call, shown as "+357 25 123456", with its own "Request a change", as the address has.
 * She types the new number (a Cyprus landline or mobile) and sends it to DocCy: founders
 * approve every clinic phone change, however many people work at the clinic. Same
 * contract as the other clinic changes (POST /api/clinic-change-requests,
 * docs/handoff/settings-redesign.md), with only the phone.
 */
export function ClinicPhoneField({
  clinicName,
  locationId,
  phone,
  canRequest,
  onSent,
}: {
  clinicName: string;
  /** Her link to the clinic (professional_clinics.id). */
  locationId: string;
  /** Display format (+357 XX XXXXXX); "" when the clinic has no phone yet. */
  phone: string;
  /** False while the clinic is being set up or already has a change in review. */
  canRequest: boolean;
  onSent: (pending: PendingClinicChange) => void;
}) {
  const fieldId = React.useId();
  const [editing, setEditing] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const normalized = normalizeCyprusClinicPhone(typed);
  const current = normalizeCyprusClinicPhone(phone);
  const invalid = typed.trim() !== "" && !normalized;
  const canSend = Boolean(normalized) && normalized !== current && !busy;

  const open = () => {
    setTyped(formatCyprusClinicPhoneInput(phone));
    setEditing(true);
  };

  async function send() {
    if (!normalized || !canSend) return;
    setBusy(true);
    try {
      // EXPECTED TO FAIL until Livio builds POST /api/clinic-change-requests (backend pending, see
      // lib/settings-backend-pending.ts): the doctor sees a message saying so.
      const res = await fetch("/api/clinic-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, changes: { phone: normalized } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(settingsActionErrorMessage("clinicChangeRequest", res.status, data, "Could not send the request."));
        return;
      }
      onSent({
        changes: { phone: normalized },
        createdAt: String(data?.request?.createdAt ?? new Date().toISOString()),
      });
      setEditing(false);
      toast.success("Request sent. We’ll email you once it’s reviewed.");
    } catch (err) {
      console.error(err);
      toast.error("Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-300">
        <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        <span className={`min-w-0 flex-1 tabular-nums ${phone ? "" : "text-amber-200"}`}>
          {phone || "No phone yet"}
        </span>
        {canRequest ? (
          <button type="button" onClick={open} aria-label="Request a phone change" className={SETTINGS_LINK_CLASS}>
            {phone ? "Request a change" : "Request your phone"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    // Not a <form>: the settings page is one already.
    <div className="mt-3">
      <label htmlFor={fieldId} className="text-xs font-medium text-slate-400">
        New phone patients call for {clinicName}. DocCy checks it before it goes live.
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[13rem] flex-1 rounded-xl border border-slate-700 bg-slate-950/60 transition focus-within:border-clinical-400/60 focus-within:ring-2 focus-within:ring-clinical-400/30 sm:max-w-xs">
          <span className="flex shrink-0 items-center gap-1.5 rounded-l-xl border-r border-slate-700 px-3 text-sm text-slate-300">
            <span className="text-slate-400">CY</span>
            <span className="font-semibold text-slate-100">+357</span>
          </span>
          <input
            id={fieldId}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            autoFocus
            aria-label="New clinic phone"
            value={typed}
            onChange={(event) => {
              const value = event.target.value;
              // Regrouping moves the caret to the end: while she edits mid-number, wait for blur.
              const caretAtEnd = event.target.selectionStart === value.length;
              setTyped(caretAtEnd ? formatCyprusClinicPhoneInput(value) : value);
            }}
            onBlur={() => setTyped((value) => formatCyprusClinicPhoneInput(value))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void send();
              } else if (event.key === "Escape" && !busy) {
                setEditing(false);
              }
            }}
            readOnly={busy}
            aria-busy={busy}
            aria-invalid={invalid}
            placeholder="25 123456"
            className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 py-2.5 text-sm tabular-nums text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
        <button
          type="button"
          onClick={() => void send()}
          disabled={!canSend}
          aria-busy={busy}
          className={`${SETTINGS_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <BusyLabel busy={busy} busyText="Sending…">
            Send request
          </BusyLabel>
        </button>
        <button type="button" disabled={busy} onClick={() => setEditing(false)} className={SETTINGS_GHOST_BUTTON_CLASS}>
          Cancel
        </button>
      </div>
      <p
        className={`mt-1.5 text-xs ${invalid ? "font-medium text-red-300" : "text-slate-400"}`}
        role={invalid ? "alert" : undefined}
      >
        {CLINIC_PHONE_HINT}
      </p>
    </div>
  );
}
