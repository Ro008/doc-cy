"use client";

import { useState, type ReactNode } from "react";
import { PROFILE_REVIEWS_SHOWN_FIRST, reviewsShownAfterMore } from "@/lib/public/profile-reviews";

type Props = {
  /** One rendered review card (<li>) each, newest first. */
  items: readonly ReactNode[];
  moreLabel: string;
};

/**
 * The reviews as one card of rows, like Services and Qualifications (user, 2026-10-14): the
 * first few, then the next ones with each "Show more reviews". There is no way back to fewer;
 * the section is the last one on the page.
 */
export function ProfileReviewsList({ items, moreLabel }: Props) {
  const [shown, setShown] = useState(PROFILE_REVIEWS_SHOWN_FIRST);
  return (
    <div className="flex flex-col gap-1">
      <ul className="divide-y divide-profile-border rounded-2xl border border-profile-border bg-profile-surface">
        {items.slice(0, shown)}
      </ul>
      {shown < items.length ? (
        <button
          type="button"
          data-testid="profile-reviews-more"
          onClick={() => setShown((n) => reviewsShownAfterMore(n, items.length))}
          className="inline-flex min-h-11 items-center self-start rounded-md text-sm font-bold text-accent-link underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {moreLabel}
        </button>
      ) : null}
    </div>
  );
}
