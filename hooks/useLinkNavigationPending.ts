"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  clearNavigationPending,
  emitNavigationStart,
  hrefMatchesCurrentLocation,
  shouldStartLinkNavigationPending,
  subscribeNavigationPending,
  type NavigationStartReason,
} from "@/lib/doccy-navigation";

/** One global pending key so only a single nav link shows loading at a time. */
export function useLinkNavigationPending(
  linkKey: string,
  navigationReason: NavigationStartReason = "default",
) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => subscribeNavigationPending(setActiveKey), []);

  useEffect(() => {
    clearNavigationPending();
  }, [pathname, searchParams]);

  useEffect(() => {
    if (activeKey !== linkKey) return;
    if (hrefMatchesCurrentLocation(linkKey, pathname, searchParams)) {
      clearNavigationPending();
    }
  }, [activeKey, linkKey, pathname, searchParams]);

  const pending = activeKey === linkKey;

  const beginNavigation = useCallback(() => {
    if (!shouldStartLinkNavigationPending(linkKey, pathname, searchParams)) return;
    emitNavigationStart(linkKey, navigationReason);
  }, [linkKey, navigationReason, pathname, searchParams]);

  return { pending, beginNavigation };
}
