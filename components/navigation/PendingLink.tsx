"use client";

import Link from "next/link";
import * as React from "react";

import { emitNavigationStart, type NavigationStartReason } from "@/lib/doccy-navigation";
import { useLinkNavigationPending } from "@/hooks/useLinkNavigationPending";

type PendingLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  "aria-current"?: "page" | undefined;
  "aria-label"?: string;
  navigationReason?: NavigationStartReason;
  /** Fill a sized parent (e.g. circular avatar link). */
  fill?: boolean;
  /** Opt out of hover prefetch (useful in dense card grids). */
  prefetch?: boolean;
};

export function PendingLink({
  href,
  children,
  className,
  "aria-current": ariaCurrent,
  "aria-label": ariaLabel,
  navigationReason = "default",
  fill = false,
  prefetch,
}: PendingLinkProps) {
  const { pending, beginNavigation } = useLinkNavigationPending(href, navigationReason);
  const isHashNavigation = href.includes("#");

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      aria-disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        if (isHashNavigation) {
          event.preventDefault();
          emitNavigationStart(href, navigationReason);
          if (href.startsWith("#")) {
            const target = document.querySelector(href);
            if (target instanceof HTMLElement) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
              window.history.pushState(null, "", href);
              return;
            }
          }
          window.location.assign(href);
          return;
        }
        // Let Next.js <Link> own navigation. Calling router.push after preventDefault
        // races prefetch/locks and surfaces AbortError ("Lock broken... steal").
        beginNavigation();
      }}
      className={fill ? `flex ${className ?? ""}`.trim() : className}
    >
      <span
        className={
          fill
            ? "relative flex h-full w-full items-center justify-center"
            : "relative inline-flex max-w-full items-center justify-center"
        }
      >
        <span
          className={
            fill
              ? `flex h-full w-full items-center justify-center transition-none ${pending ? "opacity-0" : "opacity-100"}`
              : `transition-none ${pending ? "opacity-0" : "opacity-100"}`
          }
        >
          {children}
        </span>
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-none ${
            pending ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
        </span>
      </span>
    </Link>
  );
}
