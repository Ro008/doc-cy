"use client";

import * as React from "react";
import { toast } from "sonner";
import { SettingsSwitch } from "@/components/dashboard/settings/SettingsSwitch";

/**
 * A clinic's online booking switch. Saves on its own (POST /api/doctor-online-bookings),
 * so it never counts as an unsaved change of the settings form.
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
        return;
      }
      onPausedChange(next);
      toast.success(next ? "Online bookings paused." : "Online bookings resumed.");
    } catch (err) {
      console.error(err);
      toast.error("Could not update online booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSwitch
      checked={!paused && !accessEnded}
      busy={busy}
      disabled={accessEnded}
      label={`Online booking at ${clinicName}`}
      onChange={(accepting) => void setPaused(!accepting)}
    />
  );
}
