"use client";

type ResponsiveBottomInsetProps = {
  enabled: boolean;
  children: React.ReactNode;
};

/**
 * Pro pages: a column one window tall under the sticky header (57px). The page's
 * `<main>` fills what is left (its own `min-h-screen` is overridden) and the
 * "About DocCy" footer sits at the bottom, so a page that fits never scrolls.
 */
const PRO_PAGE_COLUMN =
  "flex min-h-[calc(100dvh-57px)] flex-col pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0 [&>main]:min-h-0 [&>main]:flex-1";

export function ResponsiveBottomInset({ enabled, children }: ResponsiveBottomInsetProps) {
  return (
    <div className={enabled ? PRO_PAGE_COLUMN : undefined}>
      {children}
    </div>
  );
}
