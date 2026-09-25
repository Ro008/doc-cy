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
    ? "border-clinical-400/45 bg-clinical-500/15 font-semibold text-ink-50"
    : pending
      ? "border-transparent text-clinical-100"
      : "border-transparent text-ink-300 hover:bg-ink-800/80 hover:text-ink-50";

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
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${stateClass}`}
    >
      {label}
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
    </Link>
  );
}
