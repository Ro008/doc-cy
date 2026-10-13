"use client";

type ResponsiveBottomInsetProps = {
  enabled: boolean;
  children: React.ReactNode;
};

/**
 * Pages that fill the screen (`min-h-screen` on their top element) share that height with the
 * "About DocCy" footer shown to signed-in users, instead of pushing it below the fold and adding a
 * scrollbar for nothing (user, 2026-10-07). Longer pages still grow and scroll as before.
 * Under the desktop sticky header (doctor pages) the screen is that much shorter:
 * `--doccy-top-chrome` (globals.css, set while the header shows; user, 2026-10-08).
 */
const FILL_SCREEN_WITH_FOOTER =
  "flex min-h-[calc(100vh-var(--doccy-top-chrome,0px))] flex-col [&>.min-h-screen]:grow [&>.min-h-screen]:[min-height:auto]";

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
