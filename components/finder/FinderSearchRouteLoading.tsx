import { cookies } from "next/headers";
import { FinderHeaderSearchSkeleton } from "@/components/finder/FinderHeaderSearchSkeleton";
import { FinderLoadMoreLoadingGate } from "@/components/finder/FinderLoadMoreLoadingGate";
import { FinderPublicHeader } from "@/components/finder/FinderPublicHeader";
import { FinderResultsListSkeleton } from "@/components/finder/FinderResultsListSkeleton";
import { SiteSchemeRoot } from "@/components/site/SiteSchemeRoot";
import type { ProfileScheme } from "@/lib/profile-scheme";
import { isProSessionHintValue, PRO_SESSION_HINT_COOKIE } from "@/lib/pro-session-hint";
import { getSiteScheme } from "@/lib/site-default-scheme";

/**
 * Destination fallback while a district search page streams in, in the visitor's
 * Light / Dark mode (its own themed root: loading.tsx renders outside the page).
 */
export default async function FinderSearchRouteLoading() {
  const scheme = await getSiteScheme();

  return (
    <SiteSchemeRoot>
      <FinderSearchRouteLoadingView proSessionHint={readProSessionHint()} scheme={scheme} />
    </SiteSchemeRoot>
  );
}

/** The same for the Clinics tab, under its own header. */
export async function ClinicsRouteLoading() {
  const scheme = await getSiteScheme();

  return (
    <SiteSchemeRoot>
      <ClinicsSearchRouteLoadingView proSessionHint={readProSessionHint()} scheme={scheme} />
    </SiteSchemeRoot>
  );
}

export function readProSessionHint(): boolean {
  return isProSessionHintValue(cookies().get(PRO_SESSION_HINT_COOKIE)?.value);
}

/** A placeholder line in the page's heading. */
const headingBone = "rounded-lg bg-[#DCE8EB] [.doccy-profile[data-scheme=dark]_&]:bg-[#13284A]";

/**
 * The same screen as a page's own `<Suspense>` fallback, inside the page's themed root.
 * It must stay synchronous: a fallback that suspends while its boundary streams makes
 * React file the finished page under the wrong boundary, so the page's boundary never
 * completes and nothing in it hydrates (direct loads of /limassol, /clinics, 2026-10-16).
 *
 * It shows the Finder as it will arrive (user, 2026-10-17): R3's header with the search
 * row still, the heading, and cards in the shape of the real ones (FinderResultsListSkeleton).
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
      <main className="min-h-screen bg-[#ECF2F4] text-site-ink-800 [.doccy-profile[data-scheme=dark]_&]:bg-[#071122]">
        <FinderPublicHeader
          proSessionHint={proSessionHint}
          scheme={scheme}
          drawSwoosh
          search={<FinderHeaderSearchSkeleton />}
        />
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          <div className={`h-8 w-72 max-w-full ${headingBone}`} />
          <div className={`mt-2.5 h-4 w-28 ${headingBone}`} />
          <div className="mt-6">
            <FinderResultsListSkeleton />
          </div>
        </div>
      </main>
    </FinderLoadMoreLoadingGate>
  );
}

/** The Clinics tab's fallback: its header is the strip alone. */
export function ClinicsSearchRouteLoadingView({
  proSessionHint,
  scheme,
}: {
  proSessionHint: boolean;
  scheme: ProfileScheme;
}) {
  return (
    <main className="min-h-screen bg-site-ink-50 text-site-ink-800">
      <FinderPublicHeader proSessionHint={proSessionHint} scheme={scheme} />
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className={`h-10 w-64 max-w-full ${headingBone}`} />
        <FinderResultsListSkeleton count={5} variant="clinics" />
      </div>
    </main>
  );
}
