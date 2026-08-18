"use client";

import * as React from "react";

import { peekFinderLoadMoreScroll } from "@/lib/finder-load-more-scroll";

type FinderLoadMoreLoadingGateProps = {
  children: React.ReactNode;
};

/**
 * Route `loading.tsx` replaces the whole page and collapses height, which clamps
 * scroll to the top. For “Show more”, keep the previous document height and
 * restore scroll so new cards appear below without a jump.
 */
export function FinderLoadMoreLoadingGate({ children }: FinderLoadMoreLoadingGateProps) {
  const snapshot = React.useMemo(() => peekFinderLoadMoreScroll(), []);

  React.useLayoutEffect(() => {
    if (!snapshot) return;
    window.scrollTo(0, snapshot.scrollY);
  }, [snapshot]);

  if (!snapshot) return <>{children}</>;

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{ minHeight: snapshot.documentHeight }}
    >
      <span className="sr-only">Loading more results...</span>
    </div>
  );
}
