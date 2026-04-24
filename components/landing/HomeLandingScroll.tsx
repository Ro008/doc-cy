"use client";

import * as React from "react";

/**
 * Marketing home: usually start at y=0 and repeat after full load to counter
 * scroll restoration / layout-driven scroll anchoring jumps.
 * If URL includes a hash (e.g. #founders-pricing), preserve anchor scrolling.
 */
export function HomeLandingScroll() {
  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const prevRestore = history.scrollRestoration;
    history.scrollRestoration = "manual";

    const hasHashTarget = () => window.location.hash.length > 1;
    const toTop = () => {
      if (hasHashTarget()) return;
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
