"use client";

import Link from "next/link";
import * as React from "react";

import { emitNavigationStart, type NavigationStartReason } from "@/lib/doccy-navigation";
import { useLinkNavigationPending } from "@/hooks/useLinkNavigationPending";
import { isPublicFinderResultsPath } from "@/lib/finder-public-path";

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

function pathOnly(href: string): string {
  try {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return new URL(href).pathname;
    }
  } catch {
    // ignore
  }
  return href.split("?")[0]?.split("#")[0] || href;
}

function pendingClassName(base: string | undefined, pending: boolean, fill: boolean): string {
  return [
    fill ? "flex" : "",
    base ?? "",
    pending ? "pointer-events-none cursor-wait" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

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
  const clickLockRef = React.useRef(false);
  const isHashNavigation = href.includes("#");
  // Public finder URLs (`/`, `/paphos/...`, `/all/...`) are not reliable for App Router
  // soft navigation (middleware rewrite). Use a native anchor so the browser always
  // does a full document load — Next <Link> can still race soft-nav despite preventDefault.
  const needsFinderHardNav =
    !isHashNavigation && isPublicFinderResultsPath(pathOnly(href));

  React.useEffect(() => {
    if (!pending) clickLockRef.current = false;
  }, [pending]);

  function guardClick(event: React.MouseEvent): boolean {
    if (pending || clickLockRef.current) {
      event.preventDefault();
      return false;
    }
    clickLockRef.current = true;
    return true;
  }

  const content = (
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
  );

  if (needsFinderHardNav) {
    return (
      <a
        href={href}
        aria-current={ariaCurrent}
        aria-label={ariaLabel}
        aria-disabled={pending}
        aria-busy={pending}
        tabIndex={pending ? -1 : undefined}
        onClick={(event) => {
          if (!guardClick(event)) return;
          emitNavigationStart(href, navigationReason);
          beginNavigation();
        }}
        className={pendingClassName(className, pending, fill)}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      aria-disabled={pending}
      aria-busy={pending}
      tabIndex={pending ? -1 : undefined}
      onClick={(event) => {
        if (!guardClick(event)) return;
        if (isHashNavigation) {
          event.preventDefault();
          emitNavigationStart(href, navigationReason);
          if (href.startsWith("#")) {
            const target = document.querySelector(href);
            if (target instanceof HTMLElement) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
              window.history.pushState(null, "", href);
              clickLockRef.current = false;
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
      className={pendingClassName(className, pending, fill)}
    >
      {content}
    </Link>
  );
}
