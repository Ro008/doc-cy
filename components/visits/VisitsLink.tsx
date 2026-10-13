"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Moving to the Visits tab with no filters in the URL needs a fresh read (user, 2026-10-13).
 * Next 14.2.0 keeps the page the tab was first loaded with under the bare path for 30 seconds,
 * whatever filters that load carried, so "Clear filters" after opening a filtered URL showed
 * the filtered list again under the clean address.
 */
export function pushVisitsHref(router: ReturnType<typeof useRouter>, href: string): void {
  router.push(href);
  if (!href.includes("?")) router.refresh();
}

/** A link inside the Visits tab: in-app navigation, with the fresh read above. */
export function VisitsLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (href.includes("?") || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        startTransition(() => pushVisitsHref(router, href));
      }}
    >
      {children}
    </Link>
  );
}
