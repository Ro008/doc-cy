"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AuthAboutFooterProps = {
  visible: boolean;
};

const RESERVED_TOP_LEVEL_SEGMENTS = new Set([
  "agenda",
  "finder",
  "blog",
  "login",
  "internal",
  "api",
  "en",
  "el",
]);

function isLandingPath(pathname: string): boolean {
  return pathname === "/" || /^\/(en|el)\/?$/.test(pathname);
}

function isDoctorPublicProfilePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 1) {
    return !RESERVED_TOP_LEVEL_SEGMENTS.has(parts[0] ?? "");
  }
  if (parts.length === 2 && (parts[0] === "en" || parts[0] === "el")) {
    return true;
  }
  return false;
}

export function AuthAboutFooter({ visible }: AuthAboutFooterProps) {
  const pathname = usePathname();
  const isAgendaPath = pathname === "/agenda";
  const isBlogPath = pathname === "/blog" || pathname.startsWith("/blog/");

  if (
    !visible ||
    isLandingPath(pathname) ||
    isDoctorPublicProfilePath(pathname) ||
    isAgendaPath ||
    isBlogPath
  ) {
    return null;
  }

  return (
    <footer className="mx-auto mt-8 w-full max-w-6xl px-4 pb-3 sm:px-6 lg:px-8" data-testid="auth-about-footer">
      <div className="border-t border-slate-800/60 pt-5 text-center">
        <Link
          href="/"
          className="text-xs font-medium tracking-wide text-slate-300 transition hover:text-emerald-200"
        >
          About DocCy
        </Link>
      </div>
    </footer>
  );
}
