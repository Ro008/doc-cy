"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { isPrivateAreaPath } from "@/lib/analytics-scope";

/**
 * Renders its children (Google's tag and the GA4 page-view tracker) everywhere except the
 * doctor's internal area (user, 2026-10-12): Google receives the full URL of the page, and a
 * Visits search or a sign-in link can carry patient data or a token there.
 *
 * If the tag is already loaded from a public page, GA4's own switch is flipped while she is in
 * the private area, so nothing is sent on client-side navigation either.
 */
export function PrivateAreaGate({
  gaMeasurementId,
  children,
}: {
  gaMeasurementId?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const priv = isPrivateAreaPath(pathname);

  React.useEffect(() => {
    if (!gaMeasurementId) return;
    (window as unknown as Record<string, unknown>)[`ga-disable-${gaMeasurementId}`] = priv;
  }, [priv, gaMeasurementId]);

  return priv ? null : <>{children}</>;
}
