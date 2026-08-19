"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useTransition, type ReactNode } from "react";

import {
  markFinderLoadMoreScroll,
  restoreFinderLoadMoreScroll,
} from "@/lib/finder-load-more-scroll";
import { writeFinderResultsPageCookie } from "@/lib/finder-results-page-state";

type FinderLoadMoreButtonProps = {
  nextPage: number;
  scope: string;
  className?: string;
  children: ReactNode;
};

export function FinderLoadMoreButton({
  nextPage,
  scope,
  className,
  children,
}: FinderLoadMoreButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const restoreAfterRefreshRef = useRef(false);

  useLayoutEffect(() => {
    if (isPending || !restoreAfterRefreshRef.current) return;
    restoreFinderLoadMoreScroll();
    restoreAfterRefreshRef.current = false;
  }, [isPending]);

  return (
    <button
      type="button"
      disabled={isPending}
      aria-busy={isPending}
      className={[className ?? "", isPending ? "pointer-events-none cursor-wait" : ""]
        .filter(Boolean)
        .join(" ")
        .trim()}
      onClick={() => {
        if (isPending) return;
        restoreAfterRefreshRef.current = true;
        markFinderLoadMoreScroll();
        writeFinderResultsPageCookie(nextPage, scope);
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      <span className="relative inline-flex max-w-full min-w-0 items-center justify-center">
        <span
          className={`min-w-0 max-w-full transition-none ${isPending ? "opacity-0" : "opacity-100"}`}
        >
          {children}
        </span>
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-none ${
            isPending ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
        </span>
      </span>
    </button>
  );
}
