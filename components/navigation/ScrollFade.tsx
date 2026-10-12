"use client";

import * as React from "react";

/**
 * Soft fade at the bottom of the viewport while more of the page sits below,
 * so the last visible card does not look cut off. Sits above the phone tab bar.
 */
export function ScrollFade({ testId = "dashboard-scroll-fade" }: { testId?: string }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    function update() {
      const root = document.documentElement;
      setVisible(root.scrollHeight - (window.scrollY + window.innerHeight) > 24);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      data-testid={testId}
      data-visible={visible ? "true" : "false"}
      className={`pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-40 h-24 bg-gradient-to-t from-ink-900 via-ink-900/70 to-transparent transition-opacity duration-300 lg:bottom-0 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
