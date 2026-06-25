"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { emitNavigationStart } from "@/lib/doccy-navigation";
import { useLinkNavigationPending } from "@/hooks/useLinkNavigationPending";

type PendingLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  "aria-current"?: "page" | undefined;
};

export function PendingLink({
  href,
  children,
  className,
  "aria-current": ariaCurrent,
}: PendingLinkProps) {
  const router = useRouter();
  const { pending, beginNavigation } = useLinkNavigationPending(href);
  const isHashNavigation = href.includes("#");

  return (
    <Link
      href={href}
      aria-current={ariaCurrent}
      aria-disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        if (isHashNavigation) {
          event.preventDefault();
          emitNavigationStart(href);
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
      className={className}
    >
      <span className="relative inline-flex items-center justify-center">
        <span className={pending ? "opacity-0" : "opacity-100"}>{children}</span>
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

