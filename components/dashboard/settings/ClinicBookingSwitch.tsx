"use client";

import * as React from "react";
import { toast } from "sonner";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import { SettingsDialog, dialogSecondaryButtonClass } from "@/components/dashboard/settings/SettingsDialog";
import { SettingsSwitch } from "@/components/dashboard/settings/SettingsSwitch";
import { SETTINGS_LINK_CLASS, SETTINGS_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/settings/styles";
import { pauseClinicNotes, type VisitCounts } from "@/lib/clinic-hours-visits";

/**
 * A clinic's online booking switch. Saves on its own (POST /api/doctor-online-bookings),
 * so it never counts as an unsaved change of the settings form. Switching it off with
 * confirmed visits or open requests at the clinic asks first (user, 2026-10-11): they
 * are kept, she is only told.
 */
export function ClinicBookingSwitch({
  clinicName,
  locationId,
  paused,
  onPausedChange,
  accessEnded = false,
}: {
  clinicName: string;
  /** null for the legacy single-clinic row that has no location id yet. */
  locationId: string | null;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  /** Pro access has ended: shown off and disabled; the server refuses to switch it on. */
  accessEnded?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  /** What is still coming at this clinic, shown before she pauses it. */
  const [pauseWarning, setPauseWarning] = React.useState<VisitCounts | null>(null);

  /** Pausing: with visits or requests there, she confirms first. A failed check does not stop her. */
  async function requestPause() {
    if (!locationId) return setPaused(true);
    setBusy(true);
    let counts: VisitCounts = { confirmed: 0, open: 0 };
    try {
      const res = await fetch(`/api/professional-clinics/${encodeURIComponent(locationId)}/upcoming`, {
        cache: "no-store",
      });
      const data = res.ok ? await res.json().catch(() => null) : null;
      counts = { confirmed: Number(data?.confirmed) || 0, open: Number(data?.open) || 0 };
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
    if (counts.confirmed + counts.open > 0) {
      setPauseWarning(counts);
      return;
    }
    await setPaused(true);
  }

  async function setPaused(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/doctor-online-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pauseOnlineBookings: next, ...(locationId ? { locationId } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data?.message as string) || "Could not update online booking.");
        return false;
      }
      onPausedChange(next);
      toast.success(next ? "Online bookings paused." : "Online bookings resumed.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Could not update online booking.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SettingsSwitch
        checked={!paused && !accessEnded}
        busy={busy}
        disabled={accessEnded}
        label={`Online booking at ${clinicName}`}
        onChange={(accepting) => void (accepting ? setPaused(false) : requestPause())}
      />
      {pauseWarning ? (
        <SettingsDialog
          title={`Pause online booking at ${clinicName}?`}
          description="Patients will not be able to book online at this clinic until you switch it back on. Nothing is cancelled."
          onClose={() => setPauseWarning(null)}
          busy={busy}
          footer={(close) => (
            <>
              <button type="button" onClick={close} disabled={busy} className={dialogSecondaryButtonClass}>
                Keep it on
              </button>
              <button
                type="button"
                data-testid="settings-clinic-pause-confirm"
                disabled={busy}
                aria-busy={busy}
                onClick={async () => {
                  if (await setPaused(true)) close();
                }}
                className={SETTINGS_PRIMARY_BUTTON_CLASS}
              >
                <BusyLabel busy={busy} busyText="Pausing…">
                  Pause online booking
                </BusyLabel>
              </button>
            </>
          )}
        >
          <div
            className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] px-3.5 py-3 text-sm text-amber-100"
            data-testid="settings-clinic-pause-visits"
          >
            <ul className="space-y-1.5">
              {pauseClinicNotes(pauseWarning).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <a href="/agenda" className={`mt-2 inline-block ${SETTINGS_LINK_CLASS}`}>
              Open my agenda
            </a>
          </div>
        </SettingsDialog>
      ) : null}
    </>
  );
}
