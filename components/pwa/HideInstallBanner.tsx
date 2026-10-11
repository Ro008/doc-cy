"use client";

import * as React from "react";

/**
 * Keeps the "Add DocCy to your Home Screen" banner off the page that renders this (the public
 * profile, where it covered the availability and the booking form on a patient's first visit,
 * 2026-10-11). InstallBanner hides itself while `data-doccy-hide-install-banner` is on <html>.
 */
export function HideInstallBanner() {
  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-doccy-hide-install-banner", "");
    return () => root.removeAttribute("data-doccy-hide-install-banner");
  }, []);
  return null;
}
