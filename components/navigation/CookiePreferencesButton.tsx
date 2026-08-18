"use client";

import { emitOpenCookiePreferences } from "@/lib/cookie-consent";

type CookiePreferencesButtonProps = {
  className?: string;
};

export function CookiePreferencesButton({ className }: CookiePreferencesButtonProps) {
  return (
    <button
      type="button"
      data-testid="cookie-preferences-button"
      onClick={() => emitOpenCookiePreferences()}
      className={className}
    >
      Change ads cookie choice
    </button>
  );
}
