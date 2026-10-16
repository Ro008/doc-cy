import { cookies } from "next/headers";
import { FinderLoadMoreLoadingGate } from "@/components/finder/FinderLoadMoreLoadingGate";
import { FinderPublicHeader } from "@/components/finder/FinderPublicHeader";
import { FinderResultsListSkeleton } from "@/components/finder/FinderResultsListSkeleton";
import { SiteSchemeRoot } from "@/components/site/SiteSchemeRoot";
import { isProSessionHintValue, PRO_SESSION_HINT_COOKIE } from "@/lib/pro-session-hint";
import { getSiteScheme } from "@/lib/site-default-scheme";

/**
 * Destination fallback while a district / clinics search page streams in, in the
 * visitor's Light / Dark mode (its own themed root: loading.tsx renders outside the page).
 */
export default async function FinderSearchRouteLoading({
  proSessionHint,
}: {
  proSessionHint?: boolean;
} = {}) {
  const hideGuestCtas =
    proSessionHint ??
    isProSessionHintValue(cookies().get(PRO_SESSION_HINT_COOKIE)?.value);

  const scheme = await getSiteScheme();

  return (
    <FinderLoadMoreLoadingGate>
      <SiteSchemeRoot>
        <main className="min-h-screen bg-site-ink-50 text-site-ink-800">
          <FinderPublicHeader proSessionHint={hideGuestCtas} scheme={scheme} />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 h-10 w-64 max-w-full animate-pulse rounded-lg bg-site-ink-100" />
            <FinderResultsListSkeleton />
          </div>
        </main>
      </SiteSchemeRoot>
    </FinderLoadMoreLoadingGate>
  );
}
