"use client";

import { ChevronDown } from "lucide-react";
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
    <div className="overflow-hidden rounded-2xl border border-profile-border bg-profile-surface">
      <ul className="divide-y divide-profile-border">{items.slice(0, shown)}</ul>
      {shown < items.length ? (
        // The card's last row, full width, as "Show 8 more services" (user, 2026-10-14).
        <button
          type="button"
          data-testid="profile-reviews-more"
          onClick={() => setShown((n) => reviewsShownAfterMore(n, items.length))}
          className="flex min-h-12 w-full items-center justify-center gap-1.5 border-t border-profile-border px-4 text-sm font-bold text-accent-link transition hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          {moreLabel}
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
