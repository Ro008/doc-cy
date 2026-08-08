"use client";

import { useEffect, useState } from "react";

import { PendingLink } from "@/components/navigation/PendingLink";
import { finderRecentlyViewedCardClass } from "@/components/finder/finder-surface";
import {
  FINDER_DEFAULT_AVATAR_CLINIC,
  FINDER_DEFAULT_AVATAR_UNKNOWN,
} from "@/lib/finder-default-avatars";
import {
  readRecentlyViewed,
  type RecentlyViewedItem,
  type RecentlyViewedKind,
} from "@/lib/finder-recently-viewed";

type FinderRecentlyViewedProps = {
  /** When set, only show that kind (e.g. clinics page → clinics only). */
  kind?: RecentlyViewedKind;
  className?: string;
};

function photoFor(item: RecentlyViewedItem): string {
  if (item.photoUrl) return item.photoUrl;
  return item.kind === "clinic" ? FINDER_DEFAULT_AVATAR_CLINIC : FINDER_DEFAULT_AVATAR_UNKNOWN;
}

export function FinderRecentlyViewed({ kind, className }: FinderRecentlyViewedProps) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    const rows = readRecentlyViewed();
    setItems(kind ? rows.filter((row) => row.kind === kind) : rows);
  }, [kind]);

  if (items.length === 0) return null;

  return (
    <section
      className={["mt-6", className].filter(Boolean).join(" ")}
      aria-label="Recently viewed"
      data-testid="finder-recently-viewed"
    >
      <h2 className="text-sm font-semibold tracking-tight text-ink-800">Recently viewed</h2>
      <ul className="mt-3 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const meta = [item.subtitle, item.location].filter(Boolean).join(" · ");
          return (
            <li key={item.href} className="shrink-0">
              <PendingLink
                href={item.href}
                className={`${finderRecentlyViewedCardClass} flex w-[220px] items-center gap-3 no-underline sm:w-[240px]`}
                prefetch={false}
              >
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-clinical-50">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary stored photo URLs */}
                  <img
                    src={photoFor(item)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900">
                    {item.name}
                  </span>
                  {meta ? (
                    <span className="mt-0.5 block truncate text-xs text-ink-500">{meta}</span>
                  ) : null}
                </span>
              </PendingLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
