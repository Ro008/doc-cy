"use client";

import * as React from "react";
import { useDoctorSession } from "@/components/navigation/DoctorSessionProvider";

/**
 * Soft fade at the bottom of the viewport while more of the profile sits below, so
 * the last visible card does not look cut off (same idea as the doctor dashboard).
 * Painted with the page background, so it matches light and dark. Signed-in
 * professionals see the phone tab bar, so the fade sits above it (AppChrome).
 */
export function ProfileScrollFade() {
  const [visible, setVisible] = React.useState(false);
  const { showProChrome } = useDoctorSession();

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
      data-testid="profile-scroll-fade"
      data-visible={visible ? "true" : "false"}
      className={`pointer-events-none fixed inset-x-0 z-20 h-20 transition-opacity duration-300 ${
        showProChrome ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-0" : "bottom-0"
      } ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        background:
          "linear-gradient(to top, var(--p-bg) 0%, color-mix(in srgb, var(--p-bg) 70%, transparent) 45%, transparent 100%)",
      }}
    />
  );
}
