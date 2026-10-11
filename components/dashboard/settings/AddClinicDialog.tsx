"use client";

import * as React from "react";
import { validateNewClinic, type ClinicPick, type NewClinicValidation } from "@/lib/clinic-change-request";
import { findClinicLookalike, type ClinicLookalike } from "@/lib/clinic-duplicate";
import { registerClinicLocationIsComplete } from "@/lib/register-clinic-location";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import { ClinicPicker } from "@/components/dashboard/settings/ClinicPicker";
import {
  SettingsDialog,
  dialogPrimaryButtonClass,
  dialogSecondaryButtonClass,
} from "@/components/dashboard/settings/SettingsDialog";

export type NewClinic = Extract<NewClinicValidation, { ok: true }>["clinic"];

const chipClass = "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold";

/**
 * "Add clinic" (user, 2026-10-11), always clear about which of two things she is doing:
 * - "Joining a DocCy clinic": picked from DocCy's own clinics, added at once.
 * - "New clinic": found on Google Maps or with a pin, with its name and phone. It
 *   needs DocCy's approval, and only one such request waits at a time.
 * Her own clinics are not offered, and a new clinic DocCy very likely has already is
 * pointed out ("Is this your clinic? Join it instead").
 */
export function AddClinicDialog({
  onClose,
  onAdd,
  takenClinicIds,
  newClinicWaiting,
}: {
  onClose: () => void;
  /** Joins the DocCy clinic, or asks for a new one; resolves true when it worked (the dialog then closes). */
  onAdd: (clinic: NewClinic) => Promise<boolean>;
  /** The DocCy clinics she already works at. */
  takenClinicIds: readonly string[];
  /** She already has a new clinic waiting for approval: she can only join one meanwhile. */
  newClinicWaiting: boolean;
}) {
  const [pick, setPick] = React.useState<ClinicPick | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [lookalike, setLookalike] = React.useState<ClinicLookalike | null>(null);
  const onPick = React.useCallback((next: ClinicPick) => {
    setPick(next);
    setError(null);
  }, []);

  const joining = Boolean(pick?.clinicId);
  const asNew = Boolean(pick && !pick.clinicId && registerClinicLocationIsComplete(pick.location));

  // A new clinic DocCy may already have: look it up by the name she typed.
  const typedName = asNew ? (pick?.name ?? "").trim() : "";
  const latitude = pick?.location.latitude ?? null;
  const longitude = pick?.location.longitude ?? null;
  const placeId = pick?.location.placeId ?? null;
  React.useEffect(() => {
    setLookalike(null);
    if (typedName.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch(`/api/register/clinic-search?q=${encodeURIComponent(typedName)}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: ClinicLookalike[] }) => {
          if (cancelled) return;
          setLookalike(
            findClinicLookalike({ name: typedName, latitude, longitude, placeId }, data.results ?? [], takenClinicIds),
          );
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [typedName, latitude, longitude, placeId, takenClinicIds]);

  async function run(clinic: NewClinic, close: () => void) {
    setBusy(true);
    try {
      if (await onAdd(clinic)) close();
    } finally {
      setBusy(false);
    }
  }

  async function add(close: () => void) {
    if (!pick) return;
    const check = validateNewClinic(pick);
    if (check.ok === false) {
      setError(check.message);
      return;
    }
    await run(check.clinic, close);
  }

  const blocked = asNew && newClinicWaiting;

  return (
    <SettingsDialog
      wide
      title="Add a clinic"
      description="Search DocCy’s clinics first: a clinic DocCy already has is added to your profile at once. If yours isn’t there, find it on Google Maps or drop a pin, and DocCy checks it before adding it."
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
            disabled={busy || blocked || (!joining && !asNew)}
            aria-busy={busy}
            className={`${dialogPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <BusyLabel busy={busy} busyText={joining ? "Joining…" : "Sending…"}>
              {joining ? "Join clinic" : asNew ? "Send request" : "Add clinic"}
            </BusyLabel>
          </button>
        </>
      )}
    >
      <ClinicPicker onChange={onPick} takenClinicIds={takenClinicIds} />

      {joining ? (
        <div
          className="mt-3 rounded-2xl border border-clinical-400/25 bg-clinical-500/[0.08] px-3.5 py-3 text-sm text-clinical-100"
          data-testid="settings-add-clinic-joining"
        >
          <span className={`${chipClass} bg-clinical-500/20 text-clinical-100`}>Joining a DocCy clinic</span>
          <p className="mt-2">
            It is added to your profile at once. Online booking stays off there until you check your hours and
            switch it on.
          </p>
        </div>
      ) : asNew ? (
        <div
          className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] px-3.5 py-3 text-sm text-amber-100"
          data-testid="settings-add-clinic-new"
        >
          <span className={`${chipClass} bg-amber-500/20 text-amber-100`}>New clinic · needs DocCy’s approval</span>
          {blocked ? (
            <p className="mt-2">
              You already have a new clinic waiting for DocCy’s approval. Wait for the answer, or withdraw that
              request, before asking for another. You can still join a clinic DocCy already has.
            </p>
          ) : (
            <p className="mt-2">
              DocCy doesn’t have this clinic yet. We check it first and email you; it appears on your profile once
              it is approved.
            </p>
          )}
          {lookalike && !blocked ? (
            <div className="mt-3 border-t border-amber-400/20 pt-3" data-testid="settings-add-clinic-lookalike">
              <p className="font-semibold">Is this your clinic?</p>
              <p className="mt-0.5 text-amber-100/90">
                DocCy already has {lookalike.name}, {lookalike.address}.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run({ clinicId: lookalike.id, name: lookalike.name, location: pick!.location }, onClose)
                }
                className="mt-2 rounded-lg bg-clinical-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-clinical-400 disabled:opacity-50"
              >
                Join it instead
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </SettingsDialog>
  );
}
