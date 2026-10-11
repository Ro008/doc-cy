"use client";

import * as React from "react";
import { validateNewClinic, type ClinicPick, type NewClinicValidation } from "@/lib/clinic-change-request";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import { ClinicPicker } from "@/components/dashboard/settings/ClinicPicker";
import {
  SettingsDialog,
  dialogPrimaryButtonClass,
  dialogSecondaryButtonClass,
} from "@/components/dashboard/settings/SettingsDialog";

export type NewClinic = Extract<NewClinicValidation, { ok: true }>["clinic"];

/**
 * "Add clinic": the /register picker first (DocCy clinic, else Google or a pin, plus
 * name and phone). A clinic DocCy already has is joined at once (user, 2026-10-11);
 * its hours are then set on its card.
 */
export function AddClinicDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  /** Joins the DocCy clinic, or asks for a new one; resolves true when it worked (the dialog then closes). */
  onAdd: (clinic: NewClinic) => Promise<boolean>;
}) {
  const [pick, setPick] = React.useState<ClinicPick | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const onPick = React.useCallback((next: ClinicPick) => {
    setPick(next);
    setError(null);
  }, []);

  async function add(close: () => void) {
    if (!pick) return;
    const check = validateNewClinic(pick);
    if (check.ok === false) {
      setError(check.message);
      return;
    }
    setBusy(true);
    try {
      if (await onAdd(check.clinic)) close();
    } finally {
      setBusy(false);
    }
  }

  const joining = Boolean(pick?.clinicId);

  return (
    <SettingsDialog
      wide
      title="Add a clinic"
      description="Search DocCy’s clinics first. If yours isn’t there, find it on Google Maps or drop a pin, and add its name and phone. You’ll set its hours next."
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <button type="button" onClick={close} disabled={busy} className={dialogSecondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void add(close)}
            disabled={busy}
            aria-busy={busy}
            className={dialogPrimaryButtonClass}
          >
            <BusyLabel busy={busy} busyText={joining ? "Joining…" : "Adding…"}>
              {joining ? "Join clinic" : "Add clinic"}
            </BusyLabel>
          </button>
        </>
      )}
    >
      <ClinicPicker onChange={onPick} />
      {joining ? (
        <p
          className="mt-3 rounded-2xl border border-clinical-400/25 bg-clinical-500/[0.08] px-3.5 py-2.5 text-sm text-clinical-100"
          data-testid="settings-add-clinic-joining"
        >
          Joining a DocCy clinic: it is added to your profile at once. Online booking stays off there until you
          check your hours and switch it on.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </SettingsDialog>
  );
}
