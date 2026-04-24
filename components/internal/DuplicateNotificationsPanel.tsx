"use client";

import * as React from "react";

export type DuplicateNotificationItem = {
  suggestionId: string;
  manualName: string;
  manualSpecialty: string | null;
  manualDistrict: string | null;
  doctorName: string;
  doctorSpecialty: string | null;
  doctorDistrict: string | null;
  score: number;
  reason: string;
};

async function resolveSuggestion(
  suggestionId: string,
  action: "merge" | "dismiss"
): Promise<void> {
  const endpoint =
    action === "merge"
      ? "/api/internal/directory-duplicates/merge"
      : "/api/internal/directory-duplicates/dismiss";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ suggestionId }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error((payload as { message?: string }).message ?? "Action failed.");
  }
}

export function DuplicateNotificationsPanel({
  items,
}: {
  items: DuplicateNotificationItem[];
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function runAction(suggestionId: string, action: "merge" | "dismiss") {
    setBusyId(suggestionId);
    setError(null);
    try {
      await resolveSuggestion(suggestionId, action);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-400/35 bg-violet-500/10 p-5 shadow-lg shadow-black/20">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-200/90">
          Notificaciones de Duplicados
        </p>
        <h2 className="mt-1 text-lg font-semibold text-violet-100">
          {items.length} candidate match{items.length === 1 ? "" : "es"} pending review
        </h2>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-violet-100/85">No duplicate notifications right now.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const busy = busyId === item.suggestionId;
            return (
              <article key={item.suggestionId} className="rounded-xl border border-violet-300/25 bg-slate-900/50 p-4">
                <p className="text-sm text-slate-200">
                  <span className="font-semibold text-white">{item.manualName}</span> (manual) ↔{" "}
                  <span className="font-semibold text-white">{item.doctorName}</span> (registered)
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.manualSpecialty ?? "—"} · {item.manualDistrict ?? "—"} |{" "}
                  {item.doctorSpecialty ?? "—"} · {item.doctorDistrict ?? "—"}
                </p>
                <p className="mt-1 text-xs text-violet-200/90">
                  Match score {(item.score * 100).toFixed(1)}% · {item.reason}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(item.suggestionId, "merge")}
                    className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-500/35 transition hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    Merge & Delete Manual
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(item.suggestionId, "dismiss")}
                    className="rounded-lg bg-slate-700/60 px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-slate-500/40 transition hover:bg-slate-700/80 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
