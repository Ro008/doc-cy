"use client";

import * as React from "react";
import Link from "next/link";

export type DirectoryDoctorRow = {
  id: string;
  name: string;
  slug: string | null;
  specialty: string | null;
  languages: string[] | null;
  status: string | null;
};

export function InternalDirectoryClient({
  doctors,
}: {
  doctors: DirectoryDoctorRow[];
}) {
  const [nameQ, setNameQ] = React.useState("");
  const [specialtyFilter, setSpecialtyFilter] = React.useState("");
  const [languageFilter, setLanguageFilter] = React.useState("");

  const specialtyOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of doctors) {
      const s = d.specialty?.trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [doctors]);

  const languageOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of doctors) {
      for (const lang of d.languages ?? []) {
        const t = lang.trim();
        if (t) set.add(t);
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
        if (!langs.some((l) => l.trim() === languageFilter)) return false;
      }
      return true;
    });
  }, [doctors, nameQ, specialtyFilter, languageFilter]);

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

      <p className="text-sm text-slate-400">
        Showing <span className="font-medium text-slate-200">{filtered.length}</span> of{" "}
        <span className="font-medium text-slate-200">{doctors.length}</span> loaded
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((d) => (
          <li
            key={d.id}
            className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20"
          >
            <p className="text-lg font-semibold text-slate-50">{d.name}</p>
            <p className="mt-1 text-sm text-slate-400">
              <span className="text-slate-500">Specialty:</span>{" "}
              <span className="text-slate-200">{d.specialty || "—"}</span>
            </p>
            <p className="mt-2 text-sm text-slate-400">
              <span className="text-slate-500">Languages:</span>{" "}
              <span className="text-slate-200">
                {d.languages && d.languages.length > 0
                  ? d.languages.join(", ")
                  : "—"}
              </span>
            </p>
            {d.status ? (
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                Status: {d.status}
              </p>
            ) : null}
            <div className="mt-4 flex-1" />
            {d.slug ? (
              <Link
                href={`/${d.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
              >
                Public profile ↗
              </Link>
            ) : (
              <span className="text-xs text-slate-500">No slug</span>
            )}
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No doctors match your filters.</p>
      ) : null}
    </div>
  );
}
