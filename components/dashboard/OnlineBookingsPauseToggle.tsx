"use client";

import * as React from "react";

export function OnlineBookingsPauseToggle({
  initialPaused,
}: {
  initialPaused: boolean;
}) {
  const [paused, setPaused] = React.useState(initialPaused);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPaused(initialPaused);
  }, [initialPaused]);

  async function onToggle(next: boolean) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/doctor-online-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pauseOnlineBookings: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data?.message as string) || "Failed to update setting.");
        setPaused(!next);
        return;
      }
      setPaused(next);
    } catch (e) {
      console.error(e);
      setError("Something went wrong.");
      setPaused(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <label className="flex flex-1 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={paused}
            disabled={saving}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-5 w-5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400/60"
            aria-label="Pause online bookings"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">
              Pause Online Bookings
            </p>
            <p
              className={`mt-0.5 text-xs ${
                paused ? "text-amber-200" : "text-emerald-200"
              }`}
            >
              {paused
                ? "Appointments paused"
                : "Currently accepting appointments"}
            </p>
          </div>
        </label>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-200" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

