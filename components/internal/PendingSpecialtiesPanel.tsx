"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useDirectoryNav } from "@/components/internal/DirectoryNavContext";
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
  action: "map" | "approve_new" | "approve_edited" | "reject_specialty";
  mapTo?: string;
  editedSpecialty?: string;
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
  const { canMutate } = useDirectoryNav();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [mapForId, setMapForId] = React.useState<string | null>(null);
  const [mapTarget, setMapTarget] = React.useState<string>("");
  const [editForId, setEditForId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>("");
  const sortedSpecialties = React.useMemo(
    () => [...CYPRUS_MASTER_SPECIALTIES].sort((a, b) => a.localeCompare(b)),
    [],
  );

  if (items.length === 0) {
    return null;
  }

  async function mapSubmit(id: string) {
    if (!mapTarget || !isMasterSpecialty(mapTarget)) {
      const message = "Choose a standard specialty to merge with.";
      setError(message);
      toast.error(message);
      return;
    }
    setError(null);
    setBusyId(id);
    try {
      await postReview({ doctorId: id, action: "map", mapTo: mapTarget });
      setMapForId(null);
      setMapTarget("");
      toast.success("Specialty merged with existing category.");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed.";
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function approveAsSubmitted(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await postReview({ doctorId: id, action: "approve_new" });
      setMapForId(null);
      setMapTarget("");
      toast.success("Specialty approved as submitted. You can verify their license next.");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed.";
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function rejectSpecialty(id: string, submittedLabel: string) {
    const ok = window.confirm(
      `Reject "${submittedLabel}" for DocCy?\n\nThe professional's application will be closed (status: rejected). License review is skipped.`,
    );
    if (!ok) return;

    setError(null);
    setBusyId(id);
    try {
      await postReview({ doctorId: id, action: "reject_specialty" });
      setMapForId(null);
      setEditForId(null);
      toast.success("Specialty rejected. Application closed.");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed.";
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function approveEdited(id: string) {
    const edited = editValue.trim();
    if (!edited) {
      const message = "Specialty name is required.";
      setError(message);
      toast.error(message);
      return;
    }
    setError(null);
    setBusyId(id);
    try {
      await postReview({ doctorId: id, action: "approve_edited", editedSpecialty: edited });
      setMapForId(null);
      setMapTarget("");
      setEditForId(null);
      setEditValue("");
      toast.success("Specialty approved after edit. You can verify their license next.");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed.";
      setError(message);
      toast.error(message);
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
            {canMutate
              ? "Custom specialties must be resolved here before you can verify their license. Approve as submitted, fix a typo, merge with an existing category, or reject the specialty (closes the application)."
              : "Custom specialties waiting for founder review. This view is read-only."}
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
          const editing = editForId === row.id;
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
                {canMutate ? (
                <div className="flex flex-shrink-0 flex-col gap-2 sm:items-end">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMapForId(row.id);
                        setMapTarget("");
                        setEditForId(null);
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Merge with existing
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approveAsSubmitted(row.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-clinical-500/20 px-3 py-1.5 text-xs font-semibold text-clinical-100 ring-1 ring-clinical-500/40 hover:bg-clinical-500/30 disabled:opacity-50"
                    >
                      Approve as submitted
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditForId(row.id);
                        setEditValue(spec === "—" ? "" : spec);
                        setMapForId(null);
                        setMapTarget("");
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-clinical-500/40 bg-clinical-500/10 px-3 py-1.5 text-xs font-medium text-clinical-100 hover:bg-clinical-500/20 disabled:opacity-50"
                    >
                      Edit typo and approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => rejectSpecialty(row.id, spec)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Reject specialty
                    </button>
                  </div>
                </div>
                ) : null}
              </div>

              {canMutate && mapping ? (
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-800/80 pt-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Merge into standard specialty
                    </label>
                    <select
                      value={mapTarget}
                      onChange={(e) => setMapTarget(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="">Select…</option>
                      {sortedSpecialties.map((s) => (
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
                    className="rounded-lg bg-clinical-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-clinical-400 disabled:opacity-50"
                  >
                    Save merge
                  </button>
                </div>
              ) : null}

              {canMutate && editing ? (
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-800/80 pt-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Corrected specialty label
                    </label>
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="e.g. Wellness"
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || !editValue.trim()}
                    onClick={() => approveEdited(row.id)}
                    className="rounded-lg bg-clinical-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-clinical-400 disabled:opacity-50"
                  >
                    Save and approve
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
