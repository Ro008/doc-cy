"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parsePastVisitsParams, pastVisitsHref } from "@/lib/past-visits";

/**
 * Reads the list again when it does not belong to the address shown (user, 2026-10-13).
 * Next 14.2.0 keeps the page the tab was first loaded with under the bare path for 30 seconds,
 * whatever filters that load carried: the top bar's "Visits" tab (or the back button) then
 * showed the filtered list under the clean address. `href` is the address the server built the
 * list for.
 */
export function VisitsFreshness({ href }: { href: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const asked = React.useRef<string | null>(null);
  const current = pastVisitsHref(parsePastVisitsParams(Object.fromEntries(params.entries())));

  React.useEffect(() => {
    if (current === href) {
      asked.current = null;
      return;
    }
    // Once per address: never a loop if the two keep disagreeing.
    if (asked.current === current) return;
    asked.current = current;
    router.refresh();
  }, [current, href, router]);

  return null;
}
