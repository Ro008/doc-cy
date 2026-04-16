"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "doccy_install_banner_dismissed";
const INSTALL_BANNER_VISIBILITY_EVENT = "doccy:install-banner-visibility";
type BannerMode = "ios" | "android" | "generic";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const mobileByUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return mobileByUa || window.matchMedia("(max-width: 1024px)").matches;
}

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOsDesktopLike =
    platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return isAppleMobile || isIpadOsDesktopLike;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<BannerMode>("generic");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    if (dismissed) return;

    if (!isMobileDevice()) return;
    if (isStandaloneMode()) return;

    if (isIosDevice()) {
      setMode("ios");
      setVisible(true);
      return;
    }

    // Standard Android install flow: listen for browser install prompt event.
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setMode("android");
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // Fallback for mobile browsers without prompt support.
    const fallbackTimer = window.setTimeout(() => {
      setMode("generic");
      setVisible(true);
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const message =
    mode === "ios"
      ? "Add DocCy to your Home Screen! Tap the share icon and then 'Add to Home Screen'."
      : mode === "android"
        ? "Install DocCy for a full-screen app experience on your phone."
        : "Add DocCy to your Home Screen from your browser menu for faster access.";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(INSTALL_BANNER_VISIBILITY_EVENT, {
        detail: { visible },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent(INSTALL_BANNER_VISIBILITY_EVENT, {
          detail: { visible: false },
        })
      );
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-[95] rounded-2xl border border-[#00FFD5] bg-black/90 p-4 text-white shadow-xl backdrop-blur-sm sm:bottom-4">
      <div className="flex items-start gap-3 sm:items-center">
        <p className="text-sm leading-relaxed">{message}</p>
        {mode === "android" && deferredPrompt ? (
          <button
            type="button"
            onClick={async () => {
              await deferredPrompt.prompt();
              await deferredPrompt.userChoice.catch(() => undefined);
              setDeferredPrompt(null);
              setVisible(false);
            }}
            className="shrink-0 rounded-md bg-[#00FFD5] px-2.5 py-1.5 text-xs font-semibold text-black transition hover:opacity-90"
          >
            Install
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="shrink-0 rounded-md border border-[#00FFD5]/70 px-2 py-1 text-xs font-medium text-[#00FFD5] transition hover:bg-[#00FFD5]/10"
          aria-label="Close install banner"
        >
          Close
        </button>
      </div>
    </div>
  );
}
