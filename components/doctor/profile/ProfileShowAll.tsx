"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * A card of rows that shows its first rows and a "Show N more" row for the rest (Services &
 * prices, Qualifications). It only folds when that saves real space: up to `collapseAbove`
 * rows all show (user, 2026-10-14). The other rows stay in the page for search engines, only
 * hidden (display: none, so the browser's find-in-page does not reach them until opened).
 */
export function ProfileShowAll({
  name,
  shown,
  collapseAbove,
  total,
  showMoreLabel,
  showFewerLabel,
  className,
  listClassName,
  children,
}: {
  /** Which list: names its ids (`profile-services-list`, `profile-qualifications-show-all`). */
  name: "services" | "qualifications";
  /** Rows visible while folded; 6 at most, as nth-child below. */
  shown: 6;
  /** Fold only past this many rows. */
  collapseAbove: number;
  total: number;
  showMoreLabel: string;
  showFewerLabel: string;
  /** The card around the rows and the button. */
  className: string;
  listClassName: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const collapsible = total > collapseAbove;
  const collapsed = collapsible && !open;
  return (
    <div className={className}>
      <ul
        id={`profile-${name}-list`}
        data-collapsed={collapsed ? "" : undefined}
        className={`${listClassName} [&[data-collapsed]>li:nth-child(n+7)]:hidden`}
      >
        {children}
      </ul>
      {collapsible ? (
        // The card's last row, full width, so it reads as more of the list, not a footnote.
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`profile-${name}-list`}
          onClick={() => setOpen((value) => !value)}
          data-testid={`profile-${name}-show-all`}
          className="flex min-h-12 w-full items-center justify-center gap-1.5 border-t border-profile-border px-4 text-sm font-bold text-accent-link transition hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          {open ? showFewerLabel : showMoreLabel}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
