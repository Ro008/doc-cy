"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = React.useState(false);
  const isHashNavigation = href.includes("#");

  React.useEffect(() => {
    // Clear link-level pending state once navigation URL updates.
    setPending(false);
  }, [pathname, searchParams]);

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
          window.dispatchEvent(new Event(START_EVENT));
          window.location.assign(href);
          return;
        }
        event.preventDefault();
        window.dispatchEvent(new Event(START_EVENT));
        setPending(true);
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

