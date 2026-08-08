"use client";

import { useEffect } from "react";

import {
  recordRecentlyViewed,
  type RecentlyViewedItemInput,
} from "@/lib/finder-recently-viewed";

/** Records a profile visit into localStorage once on mount. */
export function RecordRecentlyViewed({ item }: { item: RecentlyViewedItemInput }) {
  const { kind, href, name, subtitle, location, photoUrl } = item;

  useEffect(() => {
    recordRecentlyViewed({ kind, href, name, subtitle, location, photoUrl });
  }, [kind, href, name, subtitle, location, photoUrl]);

  return null;
}
