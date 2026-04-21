"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const START_EVENT = "doccy:navigation-start";

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
  const [pending, setPending] = React.useState(false);

  return (
    <Link
      href={href}
      aria-current={ariaCurrent}
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        window.dispatchEvent(new Event(START_EVENT));
        setPending(true);
        router.push(href);
      }}
      className={className}
    >
      <span className="inline-flex items-center gap-2">
        {children}
        {pending ? (
          <span
            aria-hidden
            className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent"
          />
        ) : null}
      </span>
    </Link>
  );
}

