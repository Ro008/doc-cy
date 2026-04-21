"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type LocaleValue = "en" | "el";

const LOCALES: Array<{ value: LocaleValue; label: string }> = [
  { value: "en", label: "EN" },
  { value: "el", label: "GR" },
];
const START_EVENT = "doccy:navigation-start";

function currentLocaleFromPath(pathname: string): LocaleValue {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  if (first === "en" || first === "el") return first;
  return "en";
}

function hrefForLocale(pathname: string, locale: LocaleValue): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return `/${locale}`;

  if (parts[0] === "en" || parts[0] === "el") {
    parts[0] = locale;
  } else {
    parts.unshift(locale);
  }

  return `/${parts.join("/")}`;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const currentLocale = currentLocaleFromPath(pathname);
  const [pendingLocale, setPendingLocale] = React.useState<LocaleValue | null>(null);

  React.useEffect(() => {
    setPendingLocale(null);
  }, [pathname]);

  return (
    <div
      className={[
        "inline-flex items-center rounded-full border border-slate-200/20 bg-slate-900/30 p-1 backdrop-blur",
        compact ? "scale-95 origin-right" : "",
      ].join(" ")}
    >
      {LOCALES.map((l) => {
        const active = l.value === currentLocale;
        return (
          <Link
            key={l.value}
            href={hrefForLocale(pathname, l.value)}
            aria-current={active ? "page" : undefined}
            aria-disabled={pendingLocale !== null}
            onClick={(event) => {
              if (active || pendingLocale !== null) {
                event.preventDefault();
                return;
              }
              setPendingLocale(l.value);
              window.dispatchEvent(new Event(START_EVENT));
            }}
            className={[
              compact
                ? "px-2.5 py-1 text-[11px] font-semibold rounded-full transition"
                : "px-3 py-1.5 text-xs font-semibold rounded-full transition",
              active
                ? "bg-emerald-400 text-slate-950"
                : "text-slate-300 hover:bg-slate-800/70 hover:text-slate-50",
              pendingLocale !== null ? "pointer-events-none opacity-85" : "",
            ].join(" ")}
          >
            <span className="inline-flex items-center gap-1.5">
              {l.label}
              {pendingLocale === l.value ? (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-r-transparent"
                />
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

