"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useLinkNavigationPending } from "@/hooks/useLinkNavigationPending";

type DesktopNavTabLinkProps = {
  href: string;
  label: string;
  /** The page currently shown (drives aria-current). */
  isActive: boolean;
  /** Highlighted under the sliding pill: the active tab, or the one being opened. */
  isSelected: boolean;
  badge?: string | null;
  tabRef?: (el: HTMLAnchorElement | null) => void;
  "data-testid"?: string;
};

/**
 * Tab label in the sticky doctor header. The teal pill behind it is drawn by
 * DesktopNavTabs, so loading never changes this tab's width.
 */
export function DesktopNavTabLink({
  href,
  label,
  isActive,
  isSelected,
  badge,
  tabRef,
  "data-testid": testId,
}: DesktopNavTabLinkProps) {
  const router = useRouter();
  const { pending, beginNavigation } = useLinkNavigationPending(href);

  return (
    <Link
      ref={tabRef}
      href={href}
      data-testid={testId}
      data-selected={isSelected ? "true" : "false"}
      aria-current={isActive ? "page" : undefined}
      aria-busy={pending}
      onClick={(event) => {
        if (pending || isActive) {
          if (!isActive) event.preventDefault();
          return;
        }
        event.preventDefault();
        beginNavigation();
        router.push(href);
      }}
      className={`relative z-10 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm no-underline transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 ${
        isSelected
          ? "font-semibold text-ink-900 hover:text-ink-900"
          : "font-medium text-clinical-100 hover:bg-clinical-500/15 hover:text-white"
      }`}
    >
      {label}
      {badge ? (
        <span
          data-testid={testId ? `${testId}-badge` : undefined}
          aria-label={`${badge} waiting`}
          key={badge}
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums motion-safe:animate-pop ${
            isSelected ? "bg-ink-900 text-clinical-200" : "bg-clinical-500 text-ink-900"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
