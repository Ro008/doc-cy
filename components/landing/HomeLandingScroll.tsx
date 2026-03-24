"use client";

import * as React from "react";

/**
 * Marketing home: always start at y=0 and repeat after full load to counter
 * scroll restoration / layout-driven scroll anchoring jumps.
 */
export function HomeLandingScroll() {
  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const prevRestore = history.scrollRestoration;
    history.scrollRestoration = "manual";

    const toTop = () => {
      window.scrollTo(0, 0);
    };

    toTop();
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(toTop);
    });

    const onLoad = () => toTop();
    window.addEventListener("load", onLoad);

    return () => {
      cancelAnimationFrame(outer);
      window.removeEventListener("load", onLoad);
      history.scrollRestoration = prevRestore;
    };
  }, []);

  return null;
}
