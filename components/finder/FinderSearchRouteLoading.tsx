import { cookies } from "next/headers";
import { FinderLoadMoreLoadingGate } from "@/components/finder/FinderLoadMoreLoadingGate";
import { FinderPublicHeader } from "@/components/finder/FinderPublicHeader";
import { FinderResultsListSkeleton } from "@/components/finder/FinderResultsListSkeleton";
import { SiteSchemeRoot } from "@/components/site/SiteSchemeRoot";
import type { ProfileScheme } from "@/lib/profile-scheme";
import { isProSessionHintValue, PRO_SESSION_HINT_COOKIE } from "@/lib/pro-session-hint";
import { getSiteScheme } from "@/lib/site-default-scheme";

/**
 * Destination fallback while a district / clinics search page streams in, in the
 * visitor's Light / Dark mode (its own themed root: loading.tsx renders outside the page).
 */
export default async function FinderSearchRouteLoading() {
  const scheme = await getSiteScheme();

  return (
    <SiteSchemeRoot>
      <FinderSearchRouteLoadingView proSessionHint={readProSessionHint()} scheme={scheme} />
    </SiteSchemeRoot>
  );
}

export function readProSessionHint(): boolean {
  return isProSessionHintValue(cookies().get(PRO_SESSION_HINT_COOKIE)?.value);
}

/**
 * The same screen as a page's own `<Suspense>` fallback, inside the page's themed root.
 * It must stay synchronous: a fallback that suspends while its boundary streams makes
 * React file the finished page under the wrong boundary, so the page's boundary never
 * completes and nothing in it hydrates (direct loads of /limassol, /clinics, 2026-10-16).
 */
export function FinderSearchRouteLoadingView({
  proSessionHint,
  scheme,
}: {
  proSessionHint: boolean;
  scheme: ProfileScheme;
}) {
  return (
    <FinderLoadMoreLoadingGate>
      <main className="min-h-screen bg-site-ink-50 text-site-ink-800">
        <FinderPublicHeader proSessionHint={proSessionHint} scheme={scheme} />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 h-10 w-64 max-w-full animate-pulse rounded-lg bg-site-ink-100" />
          <FinderResultsListSkeleton />
        </div>
      </main>
    </FinderLoadMoreLoadingGate>
  );
}
