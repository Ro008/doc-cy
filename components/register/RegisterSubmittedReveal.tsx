"use client";

import * as React from "react";

/**
 * After a long form the thank-you page opens wherever they had scrolled (the
 * browser keeps the position), so the message sat above the fold. Bring it into
 * view, give it one small bounce so the eye lands on it, and move focus to its
 * heading for screen readers.
 */
export function RegisterSubmittedReveal({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const heading = panel.querySelector<HTMLElement>("h2");

    // Let the browser finish restoring the old position first, or it wins.
    const frame = requestAnimationFrame(() => {
      const top = panel.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
      heading?.focus({ preventScroll: true });
    });
    const bounce = window.setTimeout(() => setRevealed(true), reduceMotion ? 0 : 450);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(bounce);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-testid="register-submitted-panel"
      data-revealed={revealed ? "1" : "0"}
      className="register-submitted-reveal scroll-mt-6"
    >
      {children}
    </div>
  );
}
