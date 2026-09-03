"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Ctx = {
  /** Client-side query updates without scrolling to top of the page. */
  navigate: (href: string) => void;
  /** Founder can approve/reject; partner is read-only. */
  canMutate: boolean;
};

const DirectoryNavContext = React.createContext<Ctx | null>(null);

export function useDirectoryNav(): Ctx {
  const ctx = React.useContext(DirectoryNavContext);
  if (!ctx) {
    throw new Error("useDirectoryNav must be used within InternalDirectoryShell");
  }
  return ctx;
}

function sortedQueryString(sp: URLSearchParams): string {
  return Array.from(sp.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function canonicalPathWithQuery(pathname: string, sp: URLSearchParams): string {
  const q = sortedQueryString(sp);
  return q ? `${pathname}?${q}` : pathname;
}

export function InternalDirectoryShell({
  children,
  canMutate = false,
}: {
  children: React.ReactNode;
  canMutate?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [navigating, setNavigating] = React.useState(false);
  const snapshotRef = React.useRef(`${pathname}?${searchParams.toString()}`);

  React.useEffect(() => {
    const next = `${pathname}?${searchParams.toString()}`;
    if (snapshotRef.current !== next) {
      snapshotRef.current = next;
      setNavigating(false);
    }
  }, [pathname, searchParams]);

  const navigate = React.useCallback(
    (href: string) => {
      let targetPath = "";
      let targetSearch = new URLSearchParams();
      try {
        const u = new URL(href, "http://doccy.internal");
        targetPath = u.pathname;
        targetSearch = u.searchParams;
      } catch {
        return;
      }
      const current = canonicalPathWithQuery(pathname, searchParams);
      const target = canonicalPathWithQuery(targetPath, targetSearch);
      if (target === current) return;

      setNavigating(true);
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const ctx = React.useMemo(() => ({ navigate, canMutate }), [navigate, canMutate]);

  const isNavigating = isPending || navigating;

  return (
    <DirectoryNavContext.Provider value={ctx}>
      <div className="relative">
        {children}
        {isNavigating ? (
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/45 px-4 pt-[28vh] backdrop-blur-[3px] transition-opacity"
            aria-busy="true"
            aria-live="polite"
            role="status"
          >
            <div className="pointer-events-none rounded-2xl border border-clinical-500/35 bg-slate-900/95 px-5 py-3 text-center shadow-2xl shadow-black/40">
              <p className="text-sm font-semibold text-clinical-100">Updating dashboard…</p>
              <p className="mt-1 text-xs text-slate-400">Applying filters or sort</p>
            </div>
          </div>
        ) : null}
      </div>
    </DirectoryNavContext.Provider>
  );
}
