"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { emitNavigationStart } from "@/lib/doccy-navigation";

type MobileTabNavLinkProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  activeClass: string;
  inactiveClass: string;
  baseClass: string;
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
  "data-testid": testId,
}: MobileTabNavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setPending(false);
  }, [pathname, searchParams]);

  const stateClass = pending
    ? "text-clinical-200"
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
        emitNavigationStart();
        setPending(true);
        router.push(href);
      }}
      className={`${baseClass} ${stateClass} active:scale-[0.98]`}
    >
      {pending ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden />
      ) : (
        icon
      )}
      <span className={pending ? "opacity-80" : undefined}>{label}</span>
    </Link>
  );
}
