"use client";

import * as React from "react";

type Layout = "card" | "header";

export function OnlineBookingsPauseToggle({
  initialPaused,
  layout = "card",
}: {
  initialPaused: boolean;
  layout?: Layout;
}) {
  const [paused, setPaused] = React.useState(initialPaused);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPaused(initialPaused);
  }, [initialPaused]);

  async function setPausedRemote(next: boolean) {
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

  const accepting = !paused;
  const switchId = React.useId();

  const track = accepting ? "bg-emerald-500/90" : "bg-slate-600";

  const shell =
    layout === "header"
      ? "rounded-lg border border-slate-700/60 bg-slate-900/40 px-2.5 py-1.5 sm:px-3 sm:py-1.5"
      : "rounded-2xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 backdrop-blur";

  return (
    <div className={shell}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Online bookings
          </p>
          <p
            className={`mt-0 text-xs font-medium leading-tight ${
              accepting ? "text-emerald-200" : "text-amber-200/95"
            }`}
          >
            {accepting ? "Accepting appointments" : "Paused"}
          </p>
        </div>
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={accepting}
          aria-busy={saving}
          disabled={saving}
          onClick={() => setPausedRemote(!paused)}
          className={`relative h-7 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 ${track}`}
        >
          <span
            className={`absolute left-0.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
              accepting ? "translate-x-[1.125rem]" : "translate-x-0"
            }`}
            aria-hidden
          />
          <span className="sr-only">
            {accepting ? "Pause online bookings" : "Resume online bookings"}
          </span>
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
