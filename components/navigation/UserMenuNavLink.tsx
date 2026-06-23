"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { emitNavigationStart } from "@/lib/doccy-navigation";

type UserMenuNavLinkProps = {
  href: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
  title?: string;
  "data-testid"?: string;
  onNavigate?: () => void;
};

export function UserMenuNavLink({
  href,
  children,
  icon,
  className = "",
  title,
  "data-testid": testId,
  onNavigate,
}: UserMenuNavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setPending(false);
  }, [pathname, searchParams]);

  return (
    <Link
      href={href}
      title={title}
      role="menuitem"
      data-testid={testId}
      aria-busy={pending}
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        onNavigate?.();
        emitNavigationStart();
        setPending(true);
        router.push(href);
      }}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition active:scale-[0.99] ${
        pending
          ? "cursor-wait bg-clinical-500/15 text-clinical-100"
          : "text-ink-100 hover:bg-ink-800/90"
      } ${className}`}
    >
      <span className={pending ? "opacity-60" : undefined}>{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {pending ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-clinical-300" aria-hidden />
      ) : null}
    </Link>
  );
}
