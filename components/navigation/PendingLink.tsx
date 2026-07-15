"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
};

export function PendingLink({
  href,
  children,
  className,
  "aria-current": ariaCurrent,
  "aria-label": ariaLabel,
  navigationReason = "default",
  fill = false,
}: PendingLinkProps) {
  const router = useRouter();
  const { pending, beginNavigation } = useLinkNavigationPending(href, navigationReason);
  const isHashNavigation = href.includes("#");

  return (
    <Link
      href={href}
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
        event.preventDefault();
        beginNavigation();
        router.push(href);
      }}
      className={fill ? `flex ${className ?? ""}`.trim() : className}
    >
      <span
        className={
          fill
            ? "relative flex h-full w-full items-center justify-center"
            : "relative inline-flex items-center justify-center"
        }
      >
        <span
          className={
            fill
              ? `flex h-full w-full items-center justify-center ${pending ? "opacity-0" : "opacity-100"}`
              : pending
                ? "opacity-0"
                : "opacity-100"
          }
        >
          {children}
        </span>
        <span
          aria-hidden
          className={`absolute inset-0 flex items-center justify-center ${
            pending ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
        </span>
      </span>
    </Link>
  );
}

