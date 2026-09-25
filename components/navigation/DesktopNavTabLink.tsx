"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLinkNavigationPending } from "@/hooks/useLinkNavigationPending";

type DesktopNavTabLinkProps = {
  href: string;
  label: string;
  isActive: boolean;
  "data-testid"?: string;
};

/** Pill tab in the sticky doctor header (desktop). */
export function DesktopNavTabLink({
  href,
  label,
  isActive,
  "data-testid": testId,
}: DesktopNavTabLinkProps) {
  const router = useRouter();
  const { pending, beginNavigation } = useLinkNavigationPending(href);

  const stateClass = isActive
    ? "border-clinical-400 bg-clinical-500 font-semibold text-ink-900 shadow-sm shadow-clinical-500/30"
    : pending
      ? "border-clinical-400/50 bg-clinical-500/20 text-white"
      : "border-transparent text-clinical-100 hover:border-clinical-400/50 hover:bg-clinical-500/20 hover:text-white";

  return (
    <Link
      href={href}
      data-testid={testId}
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
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 ${stateClass}`}
    >
      {label}
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
    </Link>
  );
}
