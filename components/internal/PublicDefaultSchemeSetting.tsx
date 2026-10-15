"use client";

import { useState } from "react";

import type { ProfileScheme } from "@/lib/profile-scheme";

type Props = {
  /** Null when the setting could not be loaded. */
  scheme: ProfileScheme | null;
  /** Founders change it; partners only see it. */
  canEdit: boolean;
};

const LABEL: Record<ProfileScheme, string> = { light: "Light", dark: "Dark" };

/**
 * How the public site (Finder, Clinics, profiles) opens for a visitor who has not picked
 * Light or Dark (`app_settings.public_default_scheme`). Visitors who picked one keep it.
 */
export function PublicDefaultSchemeSetting({ scheme: initial, canEdit }: Props) {
  const [scheme, setScheme] = useState<ProfileScheme | null>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: ProfileScheme) {
    if (next === scheme) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/settings/public-default-scheme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheme: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { scheme?: ProfileScheme; message?: string };
      if (!res.ok || (json.scheme !== "light" && json.scheme !== "dark")) {
        setError(json.message ?? "Could not save the default mode.");
        return;
      }
      setScheme(json.scheme);
    } catch {
      setError("Could not save the default mode.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/20 p-3 text-xs text-slate-400">
      {scheme == null ? (
        <span>Public site: default mode could not be loaded.</span>
      ) : (
        <span className="text-slate-200">Public site opens in: {LABEL[scheme]}</span>
      )}
      <span>for visitors who have not picked Light or Dark; their own choice always wins.</span>

      {canEdit ? (
        <div role="group" aria-label="Default mode of the public site" className="flex items-center gap-1">
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scheme === value}
              disabled={saving}
              onClick={() => void choose(value)}
              className={`rounded-lg border px-2 py-1 disabled:opacity-60 ${
                scheme === value
                  ? "border-clinical-500/60 bg-clinical-600 font-medium text-white"
                  : "border-slate-700 text-slate-200 hover:border-clinical-500/60 hover:text-white"
              }`}
            >
              {LABEL[value]}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <span role="alert" className="text-red-300">
          {error}
        </span>
      ) : null}
    </div>
  );
}
