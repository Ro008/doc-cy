"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FinderResultsListSkeleton } from "@/components/finder/FinderResultsListSkeleton";
import {
  NAVIGATION_START_EVENT,
  type NavigationStartDetail,
} from "@/lib/doccy-navigation";
import {
  clearFinderLoadMoreScroll,
  restoreFinderLoadMoreScroll,
} from "@/lib/finder-load-more-scroll";
import { parseFinderResultsPage } from "@/lib/finder-results-paging";
import {
  clearFinderResultsPageCookie,
  finderResultsListScope,
  hrefWithoutPageQuery,
  writeFinderResultsPageCookie,
} from "@/lib/finder-results-page-state";
import { shouldShowFinderResultsSkeleton } from "@/lib/public-search-navigation";

type FinderResultsTransitionProps = {
  children: ReactNode;
};

/**
 * On filter / Professionals↔Clinics taps, replace the list with card skeletons
 * immediately so the click feels instant while the next page loads.
 */
export function FinderResultsTransition({ children }: FinderResultsTransitionProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    function onStart(event: Event) {
      const detail = (event as CustomEvent<NavigationStartDetail>).detail;
      if (shouldShowFinderResultsSkeleton(detail)) {
        clearFinderLoadMoreScroll();
        clearFinderResultsPageCookie();
        setShowSkeleton(true);
      }
    }

    window.addEventListener(NAVIGATION_START_EVENT, onStart);
    return () => window.removeEventListener(NAVIGATION_START_EVENT, onStart);
  }, []);

  useEffect(() => {
    const next = hrefWithoutPageQuery(pathname, searchParams.toString());
    if (!next) return;
    const urlPage = searchParams.get("page");
    if (urlPage) {
      writeFinderResultsPageCookie(
        parseFinderResultsPage(urlPage),
        finderResultsListScope({
          pathname,
          name: searchParams.get("name") ?? undefined,
          town: searchParams.get("town") ?? undefined,
          lat: searchParams.get("lat"),
          lon: searchParams.get("lon"),
          acc: searchParams.get("acc"),
        }),
      );
    }
    router.replace(next, { scroll: false });
  }, [pathname, router, searchParams]);

  useLayoutEffect(() => {
    restoreFinderLoadMoreScroll();
  }, [pathname, searchParams]);

  useEffect(() => {
    setShowSkeleton(false);
  }, [pathname, searchParams]);

  if (showSkeleton) {
    return <FinderResultsListSkeleton />;
  }

  return <>{children}</>;
}
