"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ProfileChangeReviewItem } from "@/lib/profile-change-requests-server";

type Props = {
  items: ProfileChangeReviewItem[];
  /** Founders decide; partners only see. */
  canMutate: boolean;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 disabled:opacity-60";
const labelClass = "flex flex-col gap-1 text-xs text-slate-400";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "");

const STATUS_WORD = { approved: "Approved", rejected: "Denied", withdrawn: "Withdrawn", pending: "Waiting" } as const;

/**
 * Requests tab: professionals' changes that need a founder (user, 2026-10-10). For
 * now the name: old → new with her reason; a founder may correct the spelling before
 * approving, and a denial needs a reason, which she is emailed.
 */
export function ProfileChangeRequestsSection({ items, canMutate }: Props) {
  const pending = items.filter((item) => item.status === "pending");
  const decided = items.filter((item) => item.status !== "pending");
  return (
    <section
      id="change-requests"
      data-testid="profile-change-requests"
      className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Change requests</h2>
        <p className="text-sm text-slate-400">
          {pending.length === 0
            ? "No profile changes waiting."
            : `${pending.length} profile change${pending.length === 1 ? "" : "s"} waiting for review.`}
        </p>
      </div>
      {pending.map((item) => (
        <ChangeCard key={item.id} item={item} canMutate={canMutate} />
      ))}
      {decided.length > 0 ? (
        <details className="rounded-xl border border-slate-800 p-3 text-sm text-slate-300">
          <summary className="cursor-pointer text-slate-200">Recent decisions</summary>
          <ul className="mt-2 space-y-1">
            {decided.map((item) => (
              <li key={item.id} data-decided-change-id={item.id}>
                <span className="font-medium">{item.professional.name}</span>{" "}
                <span className="text-slate-400">
                  {item.kind === "name"
                    ? `name: ${item.currentName ?? "?"} → ${item.approvedName ?? item.requestedName ?? "?"}`
                    : "photo"}
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

function ChangeCard({ item, canMutate }: { item: ProfileChangeReviewItem; canMutate: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(item.requestedName ?? "");
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);

  async function decide(action: "approve" | "deny") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/internal/profile-changes/${item.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { name } : { reason }),
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

  const corrected = name.trim().replace(/\s+/g, " ") !== (item.requestedName ?? "");

  return (
    <article
      data-change-request-id={item.id}
      className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-md bg-clinical-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-clinical-200">
          Name change
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

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-400">Current name</dt>
          <dd className="mt-0.5 font-medium text-slate-100">{item.currentName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Requested name</dt>
          <dd className="mt-0.5 font-medium text-emerald-200">{item.requestedName ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-400">Reason given</dt>
          <dd className="mt-0.5 text-slate-200">{item.reason ?? "None given."}</dd>
        </div>
      </dl>

      {decision ? (
        <p className={decision === "approved" ? "font-semibold text-emerald-300" : "font-semibold text-red-300"}>
          {decision === "approved" ? "Approved" : "Denied"}
        </p>
      ) : canMutate ? (
        <>
          <label className={labelClass}>
            Name to approve (correct a typo or capitals here)
            <input
              type="text"
              value={name}
              maxLength={80}
              disabled={busy !== null}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
            {corrected ? (
              <span className="text-[11px] text-amber-200">
                Differs from what was asked: the professional is told the spelling was adjusted.
              </span>
            ) : null}
          </label>
          <p className="text-xs text-slate-400">
            Approving also moves the profile to the new name&apos;s web address; the old address forwards to it.
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
