"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { profileSchemeCookie, type ProfileScheme } from "@/lib/profile-scheme";

export type SiteSchemeLabels = { group: string; light: string; dark: string };

const ENGLISH: SiteSchemeLabels = { group: "Light or dark", light: "Light", dark: "Dark" };

type Props = {
  initial: ProfileScheme;
  labels?: SiteSchemeLabels;
};

/**
 * Light / Dark switch in the public header, for anyone visiting. Switches the page at once
 * (every `.doccy-profile` root's `data-scheme`) and remembers it in a cookie for every
 * public page. Wide screens: two labelled buttons. Phones: one small button that flips.
 */
export function SiteSchemeToggle({ initial, labels = ENGLISH }: Props) {
  const [scheme, setScheme] = React.useState<ProfileScheme>(initial);

  const choose = (next: ProfileScheme) => {
    setScheme(next);
    document.querySelectorAll<HTMLElement>(".doccy-profile").forEach((root) => {
      root.dataset.scheme = next;
    });
    document.cookie = profileSchemeCookie(next);
  };

  const options: Array<{ value: ProfileScheme; label: string; Icon: typeof Sun }> = [
    { value: "light", label: labels.light, Icon: Sun },
    { value: "dark", label: labels.dark, Icon: Moon },
  ];
  const other = scheme === "dark" ? options[0] : options[1];

  return (
    <>
      <div
        role="group"
        aria-label={labels.group}
        className="hidden shrink-0 items-center gap-0.5 rounded-full border border-profile-border bg-profile-surface p-1 md:inline-flex"
      >
        {options.map(({ value, label, Icon }) => {
          const pressed = scheme === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={pressed}
              onClick={() => choose(value)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                pressed ? "bg-accent-cta text-accent-on-cta" : "text-profile-muted hover:text-profile-text"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => choose(other.value)}
        aria-label={`${labels.group}: ${other.label}`}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-profile-border bg-profile-surface text-profile-text transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
      >
        <other.Icon className="h-4 w-4" aria-hidden />
      </button>
    </>
  );
}
