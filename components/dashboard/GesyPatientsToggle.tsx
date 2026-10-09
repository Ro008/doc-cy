"use client";

import * as React from "react";
import { toast } from "sonner";
import { SETTINGS_CARD_CLASS } from "@/components/dashboard/settings/styles";
import { SettingsSwitch } from "@/components/dashboard/settings/SettingsSwitch";

export function GesyPatientsToggle({ initialAcceptsGesy }: { initialAcceptsGesy: boolean }) {
  const [acceptsGesy, setAcceptsGesy] = React.useState(initialAcceptsGesy);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

  return (
    <div className={SETTINGS_CARD_CLASS}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">Accepts GESY patients</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Display a GESY badge on your profile to help patients find you faster.
          </p>
        </div>
        <SettingsSwitch
          label="Accepts GESY patients"
          checked={acceptsGesy}
          busy={saving}
          onChange={(next) => void setAcceptsGesyRemote(next)}
        />
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
