"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageBadgeList } from "@/components/languages/LanguageBadgeList";
import {
  CYPRUS_SPOKEN_LANGUAGE_LABELS,
  canonicalLanguageLabel,
} from "@/lib/cyprus-languages";

export type DirectoryDoctorRow = {
  id: string;
  name: string;
  slug: string | null;
  specialty: string | null;
  languages: string[] | null;
  status: string | null;
  license_number: string | null;
  license_file_url: string | null;
  is_specialty_approved: boolean;
};

async function postVerification(doctorId: string, action: "verify" | "reject") {
  const res = await fetch("/api/internal/doctors/verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ doctorId, action }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message ?? res.statusText);
  }
}

export function InternalDirectoryClient({
  doctors,
}: {
  doctors: DirectoryDoctorRow[];
}) {
  const router = useRouter();
  const [nameQ, setNameQ] = React.useState("");
  const [specialtyFilter, setSpecialtyFilter] = React.useState("");
  const [languageFilter, setLanguageFilter] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const specialtyOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of doctors) {
      const s = d.specialty?.trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [doctors]);

  const languageOptions = React.useMemo(() => {
    const set = new Set<string>([...CYPRUS_SPOKEN_LANGUAGE_LABELS]);
    for (const d of doctors) {
      for (const lang of d.languages ?? []) {
        const c = canonicalLanguageLabel(String(lang).trim());
        if (c) set.add(c);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [doctors]);

  const filtered = React.useMemo(() => {
    const nq = nameQ.trim().toLowerCase();
    return doctors.filter((d) => {
      if (nq && !d.name.toLowerCase().includes(nq)) return false;
      if (specialtyFilter && d.specialty !== specialtyFilter) return false;
      if (languageFilter) {
        const langs = d.languages ?? [];
        if (
          !langs.some(
            (l) => canonicalLanguageLabel(String(l).trim()) === languageFilter
          )
        ) {
          return false;
        }
      }
      return true;
    });
  }, [doctors, nameQ, specialtyFilter, languageFilter]);

  async function runAction(doctorId: string, action: "verify" | "reject") {
    setError(null);
    setBusyId(doctorId);
    try {
      await postVerification(doctorId, action);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-slate-800/60 bg-slate-950/40 p-4 sm:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Name
          </label>
          <input
            type="search"
            value={nameQ}
            onChange={(e) => setNameQ(e.target.value)}
            placeholder="Search by name…"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Specialty
          </label>
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">All specialties</option>
            {specialtyOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Language
          </label>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">All languages</option>
            {languageOptions.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <p className="text-sm text-slate-400">
        Showing <span className="font-medium text-slate-200">{filtered.length}</span> of{" "}
        <span className="font-medium text-slate-200">{doctors.length}</span> loaded
      </p>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/30">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800/80 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Doctor</th>
              <th className="px-4 py-3 font-semibold">Specialty</th>
              <th className="px-4 py-3 font-semibold">License #</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const busy = busyId === d.id;
              const proofHref = d.license_file_url
                ? `/api/internal/doctors/${d.id}/license`
                : null;
              return (
                <tr
                  key={d.id}
                  className="border-b border-slate-800/50 last:border-0 hover:bg-slate-900/40"
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-slate-100">{d.name}</p>
                    <div className="mt-1">
                      <LanguageBadgeList languages={d.languages} compact />
                    </div>
                    {d.slug ? (
                      <Link
                        href={`/${d.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-emerald-400/90 hover:text-emerald-300"
                      >
                        Public URL ↗
                      </Link>
                    ) : (
                      <p className="mt-2 text-xs text-slate-600">No slug</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-300">
                    <span>{d.specialty || "—"}</span>
                    {!d.is_specialty_approved ? (
                      <span className="mt-1 block w-fit rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                        Specialty pending
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[140px] px-4 py-3 align-top text-xs text-slate-400">
                    <span className="break-words">{d.license_number?.trim() || "—"}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        d.status === "verified"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : d.status === "rejected"
                            ? "bg-red-500/15 text-red-200"
                            : "bg-amber-500/15 text-amber-100"
                      }`}
                    >
                      {d.status || "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(d.id, "verify")}
                        className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-500/35 transition hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        Verify doctor
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(d.id, "reject")}
                        className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-100 ring-1 ring-red-500/35 transition hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      {proofHref ? (
                        <a
                          href={proofHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500"
                        >
                          View ID proof
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600">No file</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No doctors match your filters.</p>
      ) : null}
    </div>
  );
}
