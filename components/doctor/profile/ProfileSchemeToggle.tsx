"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { profileSchemeCookie, type ProfileScheme } from "@/lib/profile-scheme";

type Props = {
  initial: ProfileScheme;
  labels: { group: string; light: string; dark: string };
};

/**
 * Light / Dark switch on the public profile, for anyone visiting. Switches the page
 * at once (the `.doccy-profile` root's `data-scheme`) and remembers it in a cookie.
 */
export function ProfileSchemeToggle({ initial, labels }: Props) {
  const [scheme, setScheme] = React.useState<ProfileScheme>(initial);
  const ref = React.useRef<HTMLDivElement>(null);

  const choose = (next: ProfileScheme) => {
    setScheme(next);
    const root = ref.current?.closest<HTMLElement>(".doccy-profile");
    if (root) root.dataset.scheme = next;
    document.cookie = profileSchemeCookie(next);
  };

  const options: Array<{ value: ProfileScheme; label: string; Icon: typeof Sun }> = [
    { value: "light", label: labels.light, Icon: Sun },
    { value: "dark", label: labels.dark, Icon: Moon },
  ];

  return (
    <div
      ref={ref}
      role="group"
      aria-label={labels.group}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-profile-border bg-profile-surface p-1"
    >
      {options.map(({ value, label, Icon }) => {
        const pressed = scheme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={pressed}
            onClick={() => choose(value)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              pressed
                ? "bg-accent-cta text-accent-on-cta"
                : "text-profile-muted hover:text-profile-text"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
