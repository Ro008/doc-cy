"use client";

import { useState, type ReactNode } from "react";
import { PROFILE_REVIEWS_SHOWN_FIRST, reviewsShownAfterMore } from "@/lib/public/profile-reviews";

type Props = {
  /** One rendered review card (<li>) each, newest first. */
  items: readonly ReactNode[];
  moreLabel: string;
};

/**
 * The review cards: the first few, then the next ones with each "Show more reviews".
 * There is no way back to fewer; the section is the last one on the page.
 */
export function ProfileReviewsList({ items, moreLabel }: Props) {
  const [shown, setShown] = useState(PROFILE_REVIEWS_SHOWN_FIRST);
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-3 sm:grid-cols-2">{items.slice(0, shown)}</ul>
      {shown < items.length ? (
        <button
          type="button"
          data-testid="profile-reviews-more"
          onClick={() => setShown((n) => reviewsShownAfterMore(n, items.length))}
          className="inline-flex min-h-11 items-center self-start rounded-full border-2 border-accent-soft px-5 text-sm font-bold text-profile-text transition hover:border-accent-cta focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cta"
        >
          {moreLabel}
        </button>
      ) : null}
    </div>
  );
}
