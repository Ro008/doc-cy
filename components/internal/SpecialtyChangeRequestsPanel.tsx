"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  CYPRUS_MASTER_SPECIALTIES,
  isMasterSpecialty,
} from "@/lib/cyprus-specialties";
import { useDirectoryNav } from "@/components/internal/DirectoryNavContext";
import { buildSpecialtyChangeApproveReviewBody } from "@/lib/doctor-specialty-change-request";

export type SpecialtyChangeRequestRow = {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorEmail: string | null;
  requestKind: "add" | "replace" | "remove";
  fromSpecialty: string;
  toSpecialty: string;
  toSpecialtyFromMaster: boolean;
  licenseNumber: string;
  createdAt: string;
};

async function postReview(body: {
  requestId: string;
  action: "approve" | "reject";
  toSpecialty?: string;
  toSpecialtyFromMaster?: boolean;
  licenseNumber?: string;
  founderNote?: string;
}) {
  const res = await fetch("/api/internal/doctors/specialty-change-review", {
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

function formatRequestedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SpecialtyChangeRequestsPanel({
  items,
}: {
  items: SpecialtyChangeRequestRow[];
}) {
  const router = useRouter();
  const { canMutate } = useDirectoryNav();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editForId, setEditForId] = React.useState<string | null>(null);
  const [editSpecialty, setEditSpecialty] = React.useState("");
  const [editLicense, setEditLicense] = React.useState("");
  const sortedSpecialties = React.useMemo(
    () => [...CYPRUS_MASTER_SPECIALTIES].sort((a, b) => a.localeCompare(b)),
    [],
  );

  if (items.length === 0) {
    return null;
  }

  async function approve(row: SpecialtyChangeRequestRow) {
    const editing = editForId === row.id;
    const built = buildSpecialtyChangeApproveReviewBody({
      requestId: row.id,
      requestKind: row.requestKind,
      fromSpecialty: row.fromSpecialty,
      toSpecialty: row.toSpecialty,
      licenseNumber: row.licenseNumber,
      editedSpecialty: editing ? editSpecialty : null,
      editedLicense: editing ? editLicense : null,
    });
    if (built.ok === false) {
      setError(built.message);
      toast.error(built.message);
      return;
    }

    if (row.requestKind === "remove") {
      const ok = window.confirm(
        `Approve removing “${row.fromSpecialty}” from ${row.doctorName}?\n\nTheir other specialties stay on the profile.`,
      );
      if (!ok) return;
    }

    setError(null);
    setBusyId(row.id);
    try {
      await postReview(built.body);
      setEditForId(null);
      toast.success(
        row.requestKind === "remove"
          ? "Specialty removed from the professional profile."
          : "Specialty updated on the professional profile.",
      );
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed.";
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(row: SpecialtyChangeRequestRow) {
    const label =
      row.requestKind === "replace" && row.fromSpecialty
        ? `${row.fromSpecialty} → ${row.toSpecialty}`
        : row.requestKind === "remove"
          ? `remove ${row.fromSpecialty}`
          : `add ${row.toSpecialty}`;
    const ok = window.confirm(
      `Reject specialty request for ${row.doctorName}?\n\n${label}\n\nTheir live specialties will stay unchanged.`,
    );
    if (!ok) return;

    setError(null);
    setBusyId(row.id);
    try {
      await postReview({ requestId: row.id, action: "reject" });
      setEditForId(null);
      toast.success("Request rejected. Profile specialty unchanged.");
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
    <section
      id="specialty-change-requests"
      className="rounded-2xl border border-sky-500/35 bg-sky-500/[0.07] p-5 shadow-lg shadow-black/20 backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-200">
          <Stethoscope className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-sky-100">
            Specialty change requests ({items.length})
          </h2>
          <p className="mt-1 text-xs text-sky-100/80">
            {canMutate
              ? "Doctors requested to add, change, or remove a specialty from settings. Approve to update their profile, or reject to leave it unchanged."
              : "Doctors requested to add, change, or remove a specialty. This view is read-only."}
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
          const editing = editForId === row.id;
          return (
            <li
              key={row.id}
              className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-100">{row.doctorName}</p>
                  {row.doctorEmail ? (
                    <p className="mt-0.5 text-xs text-slate-500">{row.doctorEmail}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="mr-2 rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-100">
                      {row.requestKind === "replace"
                        ? "Change"
                        : row.requestKind === "remove"
                          ? "Remove"
                          : "Add"}
                    </span>
                    {row.requestKind === "replace" && row.fromSpecialty ? (
                      <>
                        <span className="font-medium text-slate-200">
                          {row.fromSpecialty}
                        </span>
                        <span className="mx-1.5 text-slate-600">→</span>
                        <span className="font-medium text-sky-100">{row.toSpecialty}</span>
                      </>
                    ) : row.requestKind === "remove" ? (
                      <span className="font-medium text-sky-100">{row.fromSpecialty}</span>
                    ) : (
                      <span className="font-medium text-sky-100">{row.toSpecialty}</span>
                    )}
                    {!row.toSpecialtyFromMaster && row.requestKind !== "remove" ? (
                      <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                        Custom
                      </span>
                    ) : null}
                  </p>
                  {row.licenseNumber ? (
                    <p className="mt-1 text-xs text-slate-400">
                      License:{" "}
                      <span className="font-mono text-slate-300">{row.licenseNumber}</span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-slate-500">
                    Requested {formatRequestedAt(row.createdAt)}
                  </p>
                </div>
                {canMutate ? (
                <div className="flex flex-shrink-0 flex-wrap gap-2 sm:justify-end">
                  {row.requestKind !== "remove" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditForId(row.id);
                        setEditSpecialty(row.toSpecialty);
                        setEditLicense(row.licenseNumber);
                        setError(null);
                      }}
                      className="inline-flex items-center rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      Edit then approve
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => approve(row)}
                    className="inline-flex items-center rounded-lg bg-clinical-500/20 px-3 py-1.5 text-xs font-semibold text-clinical-100 ring-1 ring-clinical-500/40 hover:bg-clinical-500/30 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => reject(row)}
                    className="inline-flex items-center rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
                ) : null}
              </div>

              {canMutate && editing ? (
                <div className="mt-4 space-y-3 border-t border-slate-800/80 pt-4">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Specialty to apply
                    </label>
                    <select
                      value={
                        isMasterSpecialty(editSpecialty) ? editSpecialty : ""
                      }
                      onChange={(e) => setEditSpecialty(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="">Select standard specialty…</option>
                      {sortedSpecialties.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {!isMasterSpecialty(editSpecialty) && editSpecialty ? (
                      <p className="mt-1.5 text-xs text-amber-200/90">
                        Custom request “{editSpecialty}” — pick a standard label
                        above, or keep typing below.
                      </p>
                    ) : null}
                    <input
                      value={editSpecialty}
                      onChange={(e) => setEditSpecialty(e.target.value)}
                      placeholder="Or type a corrected label"
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      License number
                    </label>
                    <input
                      value={editLicense}
                      onChange={(e) => setEditLicense(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || !editSpecialty.trim() || !editLicense.trim()}
                    onClick={() => approve(row)}
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
