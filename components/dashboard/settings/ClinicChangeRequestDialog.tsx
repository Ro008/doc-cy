"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  validateClinicChangeRequest,
  type ClinicChanges,
  type ClinicPick,
} from "@/lib/clinic-change-request";
import { ClinicPicker } from "@/components/dashboard/settings/ClinicPicker";
import {
  SettingsDialog,
  dialogPrimaryButtonClass,
  dialogSecondaryButtonClass,
} from "@/components/dashboard/settings/SettingsDialog";

export type PendingClinicChange = {
  changes: ClinicChanges;
  createdAt: string;
};

/**
 * Clinic details change by request, picked the way /register picks a clinic
 * (contract: POST /api/clinic-change-requests, docs/handoff/settings-redesign.md).
 * Only the changed fields are sent.
 */
export function ClinicChangeRequestDialog({
  clinicName,
  locationId,
  current,
  onClose,
  onSent,
}: {
  clinicName: string;
  locationId: string;
  current: ClinicPick;
  onClose: () => void;
  onSent: (pending: PendingClinicChange) => void;
}) {
  const [requested, setRequested] = React.useState<ClinicPick>(current);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const onPick = React.useCallback((pick: ClinicPick) => {
    setRequested(pick);
    setError(null);
  }, []);

  async function send(close: () => void) {
    const check = validateClinicChangeRequest({
      current: { name: current.name, address: current.location.address, phone: current.phone },
      requested,
    });
    if (check.ok === false) {
      setError(check.message);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/clinic-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, changes: check.changes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data?.message as string) || "Could not send the request.");
        return;
      }
      onSent({
        changes: check.changes,
        createdAt: String(data?.request?.createdAt ?? new Date().toISOString()),
      });
      toast.success("Request sent. We’ll email you once it’s reviewed.");
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
      title={`Request a change to ${clinicName}`}
      description="Pick the clinic the way you did when you registered: from DocCy’s clinics, Google Maps or a pin. DocCy checks the change before it goes live and emails you when it’s done."
      onClose={onClose}
      footer={(close) => (
        <>
          <button type="button" onClick={close} disabled={busy} className={dialogSecondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send(close)}
            disabled={busy}
            className={dialogPrimaryButtonClass}
          >
            {busy ? "Sending…" : "Send request"}
          </button>
        </>
      )}
    >
      <ClinicPicker initial={current} onChange={onPick} />
      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </SettingsDialog>
  );
}
