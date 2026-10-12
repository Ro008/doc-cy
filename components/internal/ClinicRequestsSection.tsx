"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { ClinicRequestReviewItem } from "@/lib/clinic-requests-server";
import { formatCyprusPhoneDisplay } from "@/lib/phone-link";

type Props = {
  items: ClinicRequestReviewItem[];
  /** Founders decide; partners only see. */
  canMutate: boolean;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 disabled:opacity-60";
const labelClass = "flex flex-col gap-1 text-xs text-slate-400";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "");

const STATUS_WORD = { approved: "Approved", rejected: "Denied", withdrawn: "Withdrawn", pending: "Waiting" } as const;

/**
 * Requests tab: professionals' clinic requests (user, 2026-10-11). A new clinic: what
 * she asked for, which a founder may correct, or approve onto a clinic DocCy already
 * has. A change of details: old → new for each detail, and how many professionals
 * share the clinic. A denial needs a reason, which she is emailed and sees in Settings.
 */
export function ClinicRequestsSection({ items, canMutate }: Props) {
  const pending = items.filter((item) => item.status === "pending");
  const decided = items.filter((item) => item.status !== "pending");
  return (
    <section
      id="clinic-requests"
      data-testid="clinic-requests"
      className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Clinic requests</h2>
        <p className="text-sm text-slate-400">
          {pending.length === 0
            ? "No clinic requests waiting."
            : `${pending.length} clinic request${pending.length === 1 ? "" : "s"} waiting for review.`}
        </p>
      </div>
      {pending.map((item) => (
        <ClinicRequestCard key={item.id} item={item} canMutate={canMutate} />
      ))}
      {decided.length > 0 ? (
        <details className="rounded-xl border border-slate-800 p-3 text-sm text-slate-300">
          <summary className="cursor-pointer text-slate-200">Recent decisions</summary>
          <ul className="mt-2 space-y-1">
            {decided.map((item) => (
              <li key={item.id} data-decided-clinic-request-id={item.id}>
                <span className="font-medium">{item.professional.name}</span>{" "}
                <span className="text-slate-400">
                  {item.kind === "add"
                    ? `new clinic: ${item.clinicName || "?"}${item.created === false ? " (joined an existing clinic)" : ""}`
                    : `${item.clinicName || "clinic"}: ${item.lines.map((line) => `${line.label.toLowerCase()} → ${line.to}`).join(", ")}`}
                </span>{" "}
                <span
                  className={
                    item.status === "approved"
                      ? "text-emerald-300"
                      : item.status === "rejected"
                        ? "text-red-300"
                        : "text-slate-400"
                  }
                >
                  {STATUS_WORD[item.status]}
                </span>
                {item.decidedAt ? ` · ${day(item.decidedAt)}` : null}
                {item.decisionNote ? ` · ${item.decisionNote}` : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

type FoundClinic = { id: string; name: string; address: string };

/** Finds a clinic DocCy already has, to join her to it instead of creating a copy. */
function ExistingClinicPicker({
  picked,
  onPick,
  disabled,
}: {
  picked: FoundClinic | null;
  onPick: (clinic: FoundClinic | null) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundClinic[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch(`/api/register/clinic-search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: FoundClinic[] }) => {
          if (!cancelled) setResults((data.results ?? []).slice(0, 6));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  if (picked) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
        Approving joins her to <span className="font-semibold">{picked.name}</span> ({picked.address}). No clinic is
        created.{" "}
        <button type="button" disabled={disabled} onClick={() => onPick(null)} className="font-semibold underline">
          Create the new clinic instead
        </button>
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <label className={labelClass}>
        Does DocCy already have this clinic? Search it to join her to it instead of creating a copy
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Clinic name, street or town"
          onChange={(event) => setQuery(event.target.value)}
          className={inputClass}
          data-testid="clinic-request-existing-search"
        />
      </label>
      {results.length > 0 ? (
        <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
          {results.map((clinic) => (
            <li key={clinic.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onPick(clinic);
                  setQuery("");
                  setResults([]);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800/60"
                data-testid="clinic-request-existing-option"
              >
                <span className="font-semibold">{clinic.name}</span>{" "}
                <span className="text-slate-400">{clinic.address}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ClinicRequestCard({ item, canMutate }: { item: ClinicRequestReviewItem; canMutate: boolean }) {
  const router = useRouter();
  const isAdd = item.kind === "add";
  const askedName = (isAdd ? item.newClinic?.name : item.asked.name) ?? "";
  const askedAddress = (isAdd ? item.newClinic?.address : item.asked.address) ?? "";
  const askedPhone = (isAdd ? item.newClinic?.phone : item.asked.phone) ?? "";
  const [name, setName] = useState(askedName);
  const [address, setAddress] = useState(askedAddress);
  const [phone, setPhone] = useState(askedPhone);
  const [existing, setExisting] = useState<FoundClinic | null>(null);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);

  // Only the details she asked about can be corrected (all three for a new clinic).
  const editable = {
    name: isAdd || item.asked.name !== null,
    address: isAdd || item.asked.address !== null,
    phone: isAdd || item.asked.phone !== null,
  };
  const corrected =
    !existing &&
    ((editable.name && name.trim() !== askedName) ||
      (editable.address && address.trim() !== askedAddress) ||
      (editable.phone && phone.replace(/\D/g, "") !== askedPhone));

  async function decide(action: "approve" | "deny") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/internal/clinic-requests/${item.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "deny"
            ? { reason }
            : existing
              ? { existingClinicId: existing.id }
              : {
                  ...(editable.name ? { name } : {}),
                  ...(editable.address ? { address } : {}),
                  ...(editable.phone ? { phone } : {}),
                },
        ),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not save the decision.");
        return;
      }
      setDecision(action === "approve" ? "approved" : "rejected");
      router.refresh();
    } catch {
      setError("Could not save the decision.");
    } finally {
      setBusy(null);
    }
  }

  const others = item.professionalCount - 1;

  return (
    <article
      data-clinic-request-id={item.id}
      className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-md bg-clinical-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-clinical-200">
          {isAdd ? "New clinic" : "Clinic details"}
        </span>
        <span className="font-semibold text-slate-100">{item.professional.name}</span>
        {item.professional.email ? <span className="text-xs text-slate-400">{item.professional.email}</span> : null}
        <span className="text-xs text-slate-500">sent {day(item.createdAt)}</span>
        {item.professional.slug ? (
          <a
            href={`/en/${item.professional.slug}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs font-semibold text-clinical-300 hover:underline"
          >
            Open profile ↗
          </a>
        ) : null}
      </div>

      {isAdd ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-400">Clinic to add</dt>
            <dd className="mt-0.5 font-medium text-emerald-200">{item.newClinic?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Phone</dt>
            <dd className="mt-0.5 font-medium text-slate-100">
              {item.newClinic?.phone ? formatCyprusPhoneDisplay(item.newClinic.phone) : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-400">Address</dt>
            <dd className="mt-0.5 text-slate-200">
              {item.newClinic?.address || "—"}
              {item.newClinic?.district ? <span className="text-slate-400"> · {item.newClinic.district}</span> : null}
            </dd>
          </div>
        </dl>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-100">{item.clinicName || "Clinic"}</span>
            {item.clinic?.slug ? (
              <a
                href={`/clinics/${item.clinic.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-clinical-300 hover:underline"
              >
                Open clinic ↗
              </a>
            ) : null}
            <span
              data-testid="clinic-request-shared"
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${
                others > 0 ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/15 text-emerald-200"
              }`}
            >
              {others > 0
                ? `Shared with ${others} other professional${others === 1 ? "" : "s"}: the change applies for all`
                : "Nobody else works here"}
            </span>
          </p>
          <dl className="space-y-2">
            {item.lines.map((line) => (
              <div key={line.label}>
                <dt className="text-xs text-slate-400">{line.label}</dt>
                <dd className="mt-0.5">
                  <span className="text-slate-400 line-through">{line.from}</span>{" "}
                  <span className="font-medium text-emerald-200">→ {line.to}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {decision ? (
        <p className={decision === "approved" ? "font-semibold text-emerald-300" : "font-semibold text-red-300"}>
          {decision === "approved" ? "Approved" : "Denied"}
        </p>
      ) : canMutate ? (
        <>
          {isAdd ? <ExistingClinicPicker picked={existing} onPick={setExisting} disabled={busy !== null} /> : null}
          {existing ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              {editable.name ? (
                <label className={labelClass}>
                  Name to approve (correct a typo or capitals here)
                  <input
                    type="text"
                    value={name}
                    maxLength={120}
                    disabled={busy !== null}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                  />
                </label>
              ) : null}
              {editable.phone ? (
                <label className={labelClass}>
                  Phone to approve (Cyprus landline or mobile)
                  <input
                    type="text"
                    value={phone}
                    maxLength={20}
                    disabled={busy !== null}
                    onChange={(event) => setPhone(event.target.value)}
                    className={inputClass}
                  />
                </label>
              ) : null}
              {editable.address ? (
                <label className={`${labelClass} sm:col-span-2`}>
                  Address to approve (the map pin stays where she put it)
                  <input
                    type="text"
                    value={address}
                    maxLength={300}
                    disabled={busy !== null}
                    onChange={(event) => setAddress(event.target.value)}
                    className={inputClass}
                  />
                </label>
              ) : null}
              {corrected ? (
                <span className="text-[11px] text-amber-200 sm:col-span-2">
                  Differs from what was asked: your version is what the clinic shows.
                </span>
              ) : null}
            </div>
          )}
          <p className="text-xs text-slate-400">
            {isAdd
              ? "Approving puts the clinic on her profile, with online booking off until she switches it on."
              : editable.name
                ? "Approving changes the clinic for everyone who works there. A new name also moves the clinic’s web address; the old address forwards to it."
                : "Approving changes the clinic for everyone who works there."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void decide("approve")}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "approve" ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setDenying((value) => !value)}
              className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Deny
            </button>
          </div>
          {denying ? (
            <div className="space-y-2">
              <label className={labelClass}>
                Reason (emailed to the professional and shown in their Settings)
                <textarea
                  value={reason}
                  rows={2}
                  disabled={busy !== null}
                  onChange={(event) => setReason(event.target.value)}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                disabled={busy !== null || !reason.trim()}
                onClick={() => void decide("deny")}
                className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
              >
                {busy === "deny" ? "Denying…" : "Confirm denial"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-slate-500">Partner access is read-only: a founder decides this.</p>
      )}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-300">
          {error}
        </p>
      ) : null}
    </article>
  );
}
