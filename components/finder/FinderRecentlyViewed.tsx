"use client";

import { useEffect, useState } from "react";

import { PendingLink } from "@/components/navigation/PendingLink";
import { finderRecentlyViewedCardClass } from "@/components/finder/finder-surface";
import {
  FINDER_DEFAULT_AVATAR_CLINIC,
  FINDER_DEFAULT_AVATAR_UNKNOWN,
  rewriteLegacyFinderDefaultAvatarUrl,
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
  const photo = rewriteLegacyFinderDefaultAvatarUrl(item.photoUrl);
  if (photo) return photo;
  return item.kind === "clinic" ? FINDER_DEFAULT_AVATAR_CLINIC : FINDER_DEFAULT_AVATAR_UNKNOWN;
}

/** Same footprint as the real strip so results do not jump on hydrate. */
function RecentlyViewedSpaceReserve() {
  return (
    <div aria-hidden className="invisible pointer-events-none select-none">
      <div className="h-5 w-32" />
      <ul className="mt-3 flex gap-3 overflow-hidden pb-1">
        <li className="w-[220px] shrink-0 sm:w-[240px]">
          <div className={`${finderRecentlyViewedCardClass} flex w-full items-center gap-3`}>
            <div className="h-12 w-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-28" />
              <div className="h-3 w-20" />
            </div>
          </div>
        </li>
      </ul>
    </div>
  );
}

function RecentlyViewedList({ items }: { items: RecentlyViewedItem[] }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setRevealed(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={[
        "motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out",
        revealed ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <h2 className="text-sm font-semibold tracking-tight text-ink-800">Recently viewed</h2>
      <ul className="mt-3 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const meta = [item.subtitle, item.location].filter(Boolean).join(" · ");
          return (
            <li key={item.href} className="w-[220px] shrink-0 sm:w-[240px]">
              <PendingLink
                href={item.href}
                fill
                className={`${finderRecentlyViewedCardClass} w-full min-w-0 overflow-hidden no-underline`}
                prefetch={false}
              >
                <span className="flex w-full min-w-0 items-center gap-3 overflow-hidden">
                  <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-clinical-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary stored photo URLs */}
                    <img
                      src={photoFor(item)}
                      alt=""
                      width={48}
                      height={48}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        const fallback =
                          item.kind === "clinic"
                            ? FINDER_DEFAULT_AVATAR_CLINIC
                            : FINDER_DEFAULT_AVATAR_UNKNOWN;
                        const img = event.currentTarget;
                        if (img.src.endsWith(fallback)) return;
                        img.src = fallback;
                      }}
                    />
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-sm font-semibold text-ink-900">
                      {item.name}
                    </span>
                    {meta ? (
                      <span className="mt-0.5 block truncate text-xs text-ink-500">{meta}</span>
                    ) : null}
                  </span>
                </span>
              </PendingLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FinderRecentlyViewed({ kind, className }: FinderRecentlyViewedProps) {
  const [items, setItems] = useState<RecentlyViewedItem[] | null>(null);
  const [shellMounted, setShellMounted] = useState(true);

  useEffect(() => {
    const rows = readRecentlyViewed();
    setItems(kind ? rows.filter((row) => row.kind === kind) : rows);
  }, [kind]);

  const pending = items === null;
  const hasItems = Boolean(items && items.length > 0);
  const open = pending || hasItems;

  useEffect(() => {
    if (open) {
      setShellMounted(true);
      return;
    }
    const timeoutId = window.setTimeout(() => setShellMounted(false), 220);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  if (!shellMounted && !open) return null;

  return (
    <section
      className={[
        "grid motion-safe:transition-[grid-template-rows,margin] motion-safe:duration-200 motion-safe:ease-out",
        open ? "mt-6 grid-rows-[1fr]" : "mt-0 grid-rows-[0fr]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={hasItems ? "Recently viewed" : undefined}
      aria-hidden={pending || !hasItems ? true : undefined}
      data-testid="finder-recently-viewed"
      data-ready={pending ? "false" : "true"}
    >
      <div className="min-h-0 overflow-hidden">
        {pending ? (
          <RecentlyViewedSpaceReserve />
        ) : hasItems && items ? (
          <RecentlyViewedList items={items} />
        ) : null}
      </div>
    </section>
  );
}
