"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { PendingLink } from "@/components/navigation/PendingLink";

type MarketingFooterProps = {
  className?: string;
  forceHideLanguageSwitcher?: boolean;
};

function routeHasTwoLanguageVariants(pathname: string): boolean {
  return pathname === "/" || /^\/(en|el)\/?$/.test(pathname);
}

export function MarketingFooter({
  className = "mx-auto w-full max-w-6xl pb-24 pt-4 sm:pb-16 lg:pb-12",
  forceHideLanguageSwitcher = false,
}: MarketingFooterProps) {
  const pathname = usePathname();
  const showLanguageSwitcher =
    !forceHideLanguageSwitcher && routeHasTwoLanguageVariants(pathname);

  return (
    <section className={className} data-testid="marketing-footer">
      <div className="border-t border-slate-800/60 pt-5">
        <div className="flex flex-wrap items-center justify-start gap-2">
          <div className="inline-flex items-center rounded-full border border-slate-200/20 bg-slate-900/30 p-1 backdrop-blur">
            <PendingLink
              href="/finder"
              className="inline-flex rounded-full px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70 hover:text-slate-50"
            >
              Find a Professional
            </PendingLink>
          </div>

          <div className="inline-flex items-center rounded-full border border-slate-200/20 bg-slate-900/30 p-1 backdrop-blur">
            <Link
              href="/"
              className="inline-flex rounded-full px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70 hover:text-slate-50"
            >
              About DocCy
            </Link>
          </div>

          <div className="inline-flex items-center rounded-full border border-slate-200/20 bg-slate-900/30 p-1 backdrop-blur">
            <Link
              href="/blog"
              className="inline-flex rounded-full px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70 hover:text-slate-50"
            >
              Blog
            </Link>
          </div>

          <div className="inline-flex items-center rounded-full border border-slate-200/20 bg-slate-900/30 p-1 backdrop-blur">
            <a
              href="https://www.instagram.com/doccy_cyprus?igsh=MW94Zjg1czZ6OXNzaw=="
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Instagram
            </a>
          </div>

          {showLanguageSwitcher ? (
            <div className="inline-flex min-h-10 items-center px-0.5">
              <LanguageSwitcher />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
