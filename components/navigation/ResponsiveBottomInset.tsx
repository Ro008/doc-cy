"use client";

type ResponsiveBottomInsetProps = {
  enabled: boolean;
  children: React.ReactNode;
};

/**
 * Pages that fill the screen (`min-h-screen` on their top element) share that height with the
 * "About DocCy" footer shown to signed-in users, instead of pushing it below the fold and adding a
 * scrollbar for nothing (user, 2026-10-07). Longer pages still grow and scroll as before.
 */
const FILL_SCREEN_WITH_FOOTER =
  "flex min-h-screen flex-col [&>.min-h-screen]:grow [&>.min-h-screen]:[min-height:auto]";

export function ResponsiveBottomInset({ enabled, children }: ResponsiveBottomInsetProps) {
  return (
    <div
      className={
        enabled
          ? `${FILL_SCREEN_WITH_FOOTER} pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0`
          : FILL_SCREEN_WITH_FOOTER
      }
    >
      {children}
    </div>
  );
}
