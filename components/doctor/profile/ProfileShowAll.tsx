"use client";

import { useState, type ReactNode } from "react";

/**
 * A list that shows its first rows and a "Show all" link for the rest (Services & prices).
 * The other rows stay in the page, only hidden, so search engines and find-in-page see them.
 */
export function ProfileShowAll({
  shown,
  total,
  showAllLabel,
  showFewerLabel,
  listClassName,
  children,
}: {
  /** Rows visible before "Show all"; 6 at most, as nth-child below. */
  shown: 6;
  total: number;
  showAllLabel: string;
  showFewerLabel: string;
  listClassName: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const collapsible = total > shown;
  const collapsed = collapsible && !open;
  return (
    <div className="grid gap-3">
      <ul
        id="profile-services-list"
        data-collapsed={collapsed ? "" : undefined}
        className={`${listClassName} [&[data-collapsed]>li:nth-child(n+7)]:hidden`}
      >
        {children}
      </ul>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls="profile-services-list"
          onClick={() => setOpen((value) => !value)}
          data-testid="profile-services-show-all"
          className="justify-self-start rounded-md text-sm font-bold text-accent-link underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {open ? showFewerLabel : showAllLabel}
        </button>
      ) : null}
    </div>
  );
}
