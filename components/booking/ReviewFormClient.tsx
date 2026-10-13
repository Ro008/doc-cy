"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { BookingLinkCard, BookingLinkText } from "@/components/booking/BookingLinkPanels";
import { REVIEW_COMMENT_MAX } from "@/lib/professional-review";

type Props = {
  token: string;
  professionalName: string;
  visitDayLabel: string;
  displayName: string;
};

type Outcome = { kind: "idle" } | { kind: "sending" } | { kind: "done" } | { kind: "gone"; message: string };

const INPUT =
  "mt-1.5 w-full rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none";

/**
 * The review form on /booking/review (user, 2026-10-04). Opening the link changes nothing;
 * "Publish review" sends it. The typed email must be the one the visit was booked with.
 */
export function ReviewFormClient({ token, professionalName, visitDayLabel, displayName }: Props) {
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (outcome.kind === "sending") return;
    if (rating < 1) return setError("Please choose a rating from 1 to 5 stars.");
    if (!comment.trim()) return setError("Please write a few words about your visit.");
    setError(null);
    setOutcome({ kind: "sending" });
    try {
      const res = await fetch("/api/booking/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, comment, email }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.ok) return setOutcome({ kind: "done" });
      if (res.status === 400) {
        setError(data.message ?? "Please check the form.");
        return setOutcome({ kind: "idle" });
      }
      setOutcome({ kind: "gone", message: data.message ?? "This link no longer works." });
    } catch {
      setError("Please check your connection and try again.");
      setOutcome({ kind: "idle" });
    }
  }

  if (outcome.kind === "done") {
    return (
      <BookingLinkCard title="Thank you for your review" testId="review-thanks">
        <BookingLinkText>
          Your review of {professionalName} is published as {displayName}. It helps other patients choose.
        </BookingLinkText>
      </BookingLinkCard>
    );
  }
  if (outcome.kind === "gone") {
    return (
      <BookingLinkCard title="This link no longer works" testId="review-error">
        <BookingLinkText>{outcome.message}</BookingLinkText>
      </BookingLinkCard>
    );
  }

  const sending = outcome.kind === "sending";
  return (
    <BookingLinkCard title={`How was your visit with ${professionalName}?`} testId="review-form">
      <BookingLinkText>Your visit on {visitDayLabel}.</BookingLinkText>
      <form onSubmit={submit} className="mt-5 space-y-5 text-left" noValidate>
        <fieldset>
          <legend className="text-xs font-medium text-slate-400">Your rating</legend>
          <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  className="peer sr-only"
                  aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                />
                <Star
                  aria-hidden
                  className={`h-8 w-8 transition peer-focus-visible:ring-2 peer-focus-visible:ring-clinical-400/60 ${
                    n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-600 hover:text-slate-400"
                  }`}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="reviewComment" className="text-xs font-medium text-slate-400">
            Your review
          </label>
          <textarea
            id="reviewComment"
            value={comment}
            maxLength={REVIEW_COMMENT_MAX}
            rows={4}
            onChange={(e) => setComment(e.target.value)}
            className={`${INPUT} resize-y`}
            placeholder="What went well? What could be better?"
          />
        </div>
        <div>
          <label htmlFor="reviewEmail" className="text-xs font-medium text-slate-400">
            Your email (the one you booked with)
          </label>
          <input
            id="reviewEmail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
          <p className="mt-1 text-xs text-slate-500">So we know the review comes from the patient. It&apos;s never shown.</p>
        </div>
        <p className="rounded-xl border border-slate-700 bg-ink-900/60 px-3 py-2 text-xs leading-relaxed text-slate-300">
          Your review will appear as <strong className="text-slate-100">{displayName}</strong> with your rating and the
          date.
        </p>
        {error ? <p className="text-sm text-amber-300">{error}</p> : null}
        <button
          type="submit"
          disabled={sending}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-clinical-500/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-clinical-400 disabled:opacity-60"
        >
          {sending ? "Publishing…" : "Publish review"}
        </button>
      </form>
    </BookingLinkCard>
  );
}
