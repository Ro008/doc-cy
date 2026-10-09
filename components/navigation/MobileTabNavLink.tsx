"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLinkNavigationPending } from "@/hooks/useLinkNavigationPending";

type MobileTabNavLinkProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  activeClass: string;
  inactiveClass: string;
  baseClass: string;
  badge?: string | null;
  "data-testid"?: string;
};

export function MobileTabNavLink({
  href,
  label,
  icon,
  isActive,
  activeClass,
  inactiveClass,
  baseClass,
  badge,
  "data-testid": testId,
}: MobileTabNavLinkProps) {
  const router = useRouter();
  const { pending, beginNavigation } = useLinkNavigationPending(href);

  const stateClass = pending
    ? "text-white"
    : isActive
      ? activeClass
      : inactiveClass;

  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={isActive && !pending ? "page" : undefined}
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
      className={`${baseClass} ${stateClass} active:scale-[0.98]`}
    >
      <span className="relative inline-flex">
        {pending ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden />
        ) : (
          icon
        )}
        {badge ? (
          <span
            data-testid={testId ? `${testId}-badge` : undefined}
            aria-label={`${badge} waiting`}
            key={badge}
            className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-clinical-400 px-1 text-[10px] font-bold leading-none text-ink-900 ring-2 ring-ink-900 motion-safe:animate-pop"
          >
            {badge}
          </span>
        ) : null}
      </span>
      <span className={pending ? "opacity-80" : undefined}>{label}</span>
    </Link>
  );
}
