"use client";

import Link from "next/link";
import * as React from "react";
import { Suspense } from "react";

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

function PendingLinkView({
  href,
  children,
  className,
  "aria-current": ariaCurrent,
  "aria-label": ariaLabel,
  navigationReason = "default",
  fill = false,
  prefetch,
  pending,
  beginNavigation,
}: PendingLinkProps & {
  pending: boolean;
  beginNavigation: () => void;
}) {
  const clickLockRef = React.useRef(false);
  const isHashNavigation = href.includes("#");

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
          ? "relative flex h-full w-full min-w-0 items-center justify-center"
          : "relative inline-flex max-w-full min-w-0 items-center justify-center"
      }
    >
      <span
        className={
          fill
            ? `flex h-full w-full min-w-0 items-center justify-center transition-none ${pending ? "opacity-0" : "opacity-100"}`
            : `min-w-0 max-w-full transition-none ${pending ? "opacity-0" : "opacity-100"}`
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

function PendingLinkWithSearchParams(props: PendingLinkProps) {
  const { pending, beginNavigation } = useLinkNavigationPending(
    props.href,
    props.navigationReason,
  );
  return (
    <PendingLinkView {...props} pending={pending} beginNavigation={beginNavigation} />
  );
}

/**
 * `useSearchParams()` must sit under Suspense or Next.js prerender of static
 * pages (/blog, /terms, …) fails with missing-suspense-with-csr-bailout.
 */
export function PendingLink(props: PendingLinkProps) {
  return (
    <Suspense
      fallback={
        <PendingLinkView {...props} pending={false} beginNavigation={() => undefined} />
      }
    >
      <PendingLinkWithSearchParams {...props} />
    </Suspense>
  );
}
