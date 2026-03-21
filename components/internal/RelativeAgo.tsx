"use client";

import * as React from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";

/**
 * Relative time from the viewer's clock (client), refreshed periodically.
 * Use booking `created_at` ISO only — not slot time.
 */
export function RelativeAgo({ iso }: { iso: string | null | undefined }) {
  const [label, setLabel] = React.useState<string>(() => {
    if (!iso) return "";
    try {
      return formatDistanceToNow(parseISO(iso), {
        addSuffix: true,
        locale: enGB,
      });
    } catch {
      return "";
    }
  });

  React.useEffect(() => {
    function tick() {
      if (!iso) {
        setLabel("");
        return;
      }
      try {
        setLabel(
          formatDistanceToNow(parseISO(iso), {
            addSuffix: true,
            locale: enGB,
          })
        );
      } catch {
        setLabel("");
      }
    }
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [iso]);

  if (!iso) {
    return <span className="text-slate-600">Recently</span>;
  }
  if (!label) {
    return <span className="text-slate-600">—</span>;
  }
  return <span suppressHydrationWarning>{label}</span>;
}
