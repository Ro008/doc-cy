"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  clearNavigationPending,
  emitNavigationStart,
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

  const pending = activeKey === linkKey;

  const beginNavigation = useCallback(() => {
    emitNavigationStart(linkKey, navigationReason);
  }, [linkKey, navigationReason]);

  return { pending, beginNavigation };
}
