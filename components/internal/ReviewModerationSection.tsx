"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ReviewModerationItem } from "@/lib/review-moderation";

type Props = {
  pending: ReviewModerationItem[];
  decided: ReviewModerationItem[];
  /** Founders decide; partners only see. */
  canMutate: boolean;
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "");

const stars = (rating: number) => "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));

/**
 * Requests tab: patient reviews waiting for a founder (user, 2026-10-15). Approving puts
 * the review on the profile and in the finder's rating; rejecting (insults, advertising,
 * anything against the basic rules) is final. Nobody is told either way.
 */
export function ReviewModerationSection({ pending, decided, canMutate }: Props) {
  return (
    <section
      id="reviews"
      data-testid="review-moderation"
      className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Patient reviews</h2>
        <p className="text-sm text-slate-400">
          {pending.length === 0
            ? "No reviews waiting."
            : `${pending.length} review${pending.length === 1 ? "" : "s"} waiting for approval.`}
        </p>
      </div>
      {pending.map((item) => (
        <ReviewCard key={item.id} item={item} canMutate={canMutate} />
      ))}
      {decided.length > 0 ? (
        <details className="rounded-xl border border-slate-800 p-3 text-sm text-slate-300">
          <summary className="cursor-pointer text-slate-200">Recent decisions</summary>
          <ul className="mt-2 space-y-1">
            {decided.map((item) => (
              <li key={item.id} data-decided-review-id={item.id}>
                <span className="font-medium">{item.professional.name}</span>{" "}
                <span className="text-slate-400">
                  {stars(item.rating)} by {item.displayName}
                </span>{" "}
                <span className={item.status === "published" ? "text-emerald-300" : "text-red-300"}>
                  {item.status === "published" ? "Approved" : "Rejected"}
                </span>
                {item.moderatedAt ? ` · ${day(item.moderatedAt)}` : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ReviewCard({ item, canMutate }: { item: ReviewModerationItem; canMutate: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"published" | "rejected" | null>(null);

  async function decide(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/internal/reviews/${item.id}/${action}`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not save the decision.");
        return;
      }
      setDecision(action === "approve" ? "published" : "rejected");
      router.refresh();
    } catch {
      setError("Could not save the decision.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      data-review-id={item.id}
      className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-md bg-clinical-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-clinical-200">
          Review
        </span>
        <span className="font-semibold text-slate-100">{item.professional.name}</span>
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

      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-400">Patient</dt>
          <dd className="mt-0.5 font-medium text-slate-100">{item.reviewerName}</dd>
          <dd className="text-xs text-slate-400">{item.reviewerEmail}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Shown as</dt>
          <dd className="mt-0.5 font-medium text-slate-100">{item.displayName}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Visit</dt>
          <dd className="mt-0.5 font-medium text-slate-100">{day(item.visitAt) || "—"}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-xs text-slate-400">Rating</dt>
          <dd className="mt-0.5 text-amber-300" aria-label={`${item.rating} of 5 stars`}>
            {stars(item.rating)}
          </dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-xs text-slate-400">Review</dt>
          <dd className="mt-0.5 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-slate-100">
            {item.comment}
          </dd>
        </div>
      </dl>

      {decision ? (
        <p className={decision === "published" ? "font-semibold text-emerald-300" : "font-semibold text-red-300"}>
          {decision === "published" ? "Approved: it now shows on the profile" : "Rejected"}
        </p>
      ) : canMutate ? (
        <>
          <p className="text-xs text-slate-400">
            Approving puts it on the profile and in the finder&apos;s rating. Rejecting is final. Nobody is told
            either way.
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
            {confirmingReject ? (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void decide("reject")}
                  className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {busy === "reject" ? "Rejecting…" : "Confirm rejection"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setConfirmingReject(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setConfirmingReject(true)}
                className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                Reject
              </button>
            )}
          </div>
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
