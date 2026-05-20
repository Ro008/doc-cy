"use client";

import * as React from "react";
import { toast } from "sonner";

export function GesyPatientsToggle({ initialAcceptsGesy }: { initialAcceptsGesy: boolean }) {
  const [acceptsGesy, setAcceptsGesy] = React.useState(initialAcceptsGesy);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const switchId = React.useId();

  React.useEffect(() => {
    setAcceptsGesy(initialAcceptsGesy);
  }, [initialAcceptsGesy]);

  async function setAcceptsGesyRemote(next: boolean) {
    setError(null);
    setSaving(true);
    const previous = acceptsGesy;
    setAcceptsGesy(next);
    try {
      const res = await fetch("/api/doctor-gesy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGesy: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (data?.message as string) || "Failed to update GESY setting.";
        setError(message);
        toast.error(message);
        setAcceptsGesy(previous);
        return;
      }
      toast.success(
        next ? "GESY badge enabled on your profile." : "GESY badge hidden from your profile.",
      );
    } catch (e) {
      console.error(e);
      const message = "Something went wrong.";
      setError(message);
      toast.error(message);
      setAcceptsGesy(previous);
    } finally {
      setSaving(false);
    }
  }

  const track = acceptsGesy ? "bg-[#40C4D4]/90" : "bg-slate-600";

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={switchId} className="text-sm font-medium text-slate-100">
            Accepts GESY patients
          </label>
          <p className="mt-2 text-xs text-slate-400">
            Display a GESY badge on your profile to help patients find you faster.
          </p>
        </div>
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={acceptsGesy}
          aria-busy={saving}
          disabled={saving}
          onClick={() => void setAcceptsGesyRemote(!acceptsGesy)}
          className={`relative mt-0.5 h-7 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#40C4D4]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 ${track}`}
        >
          <span
            className={`absolute left-0.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
              acceptsGesy ? "translate-x-[1.125rem]" : "translate-x-0"
            }`}
            aria-hidden
          />
          <span className="sr-only">
            {acceptsGesy ? "Stop accepting GESY patients" : "Accept GESY patients"}
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
