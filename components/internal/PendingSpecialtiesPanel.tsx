"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Pencil } from "lucide-react";
import {
  CYPRUS_MASTER_SPECIALTIES,
  isMasterSpecialty,
} from "@/lib/cyprus-specialties";

export type PendingSpecialtyRow = {
  id: string;
  name: string;
  specialty: string | null;
  email?: string | null;
};

async function postReview(body: {
  doctorId: string;
  action: "approve" | "map";
  mapTo?: string;
}) {
  const res = await fetch("/api/internal/doctors/specialty-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message ?? res.statusText);
  }
}

export function PendingSpecialtiesPanel({ items }: { items: PendingSpecialtyRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [mapForId, setMapForId] = React.useState<string | null>(null);
  const [mapTarget, setMapTarget] = React.useState<string>("");

  if (items.length === 0) {
    return null;
  }

  async function approve(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await postReview({ doctorId: id, action: "approve" });
      setMapForId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function mapSubmit(id: string) {
    if (!mapTarget || !isMasterSpecialty(mapTarget)) {
      setError("Choose a standard specialty to map to.");
      return;
    }
    setError(null);
    setBusyId(id);
    try {
      await postReview({ doctorId: id, action: "map", mapTo: mapTarget });
      setMapForId(null);
      setMapTarget("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.07] p-5 shadow-lg shadow-black/20 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-200">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-amber-100">Pending specialties</h2>
          <p className="mt-1 text-xs text-amber-100/80">
            These doctors used &quot;Other (Specify)&quot; or have a custom label. Approve as-is or map to a
            standard category. (Adding new master list entries is still a code change — map when
            possible.)
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      ) : null}

      <ul className="mt-4 space-y-4">
        {items.map((row) => {
          const busy = busyId === row.id;
          const mapping = mapForId === row.id;
          const spec = (row.specialty ?? "").trim() || "—";
          return (
            <li
              key={row.id}
              className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-100">{row.name}</p>
                  {row.email ? (
                    <p className="mt-0.5 text-xs text-slate-500">{row.email}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="text-slate-500">Submitted:</span>{" "}
                    <span className="font-medium text-amber-100/95">{spec}</span>
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-2 sm:items-end">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approve(row.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMapForId(mapping ? null : row.id);
                        setMapTarget("");
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Edit / Map
                    </button>
                  </div>
                </div>
              </div>

              {mapping ? (
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-800/80 pt-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Map to standard specialty
                    </label>
                    <select
                      value={mapTarget}
                      onChange={(e) => setMapTarget(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="">Select…</option>
                      {CYPRUS_MASTER_SPECIALTIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !mapTarget}
                    onClick={() => mapSubmit(row.id)}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Save mapping
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
