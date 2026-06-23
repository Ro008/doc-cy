"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { PendingLink } from "@/components/navigation/PendingLink";
import { emitOpenFeedback } from "@/lib/doccy-feedback";

type MarketingFooterProps = {
  className?: string;
  forceHideLanguageSwitcher?: boolean;
  variant?: "dark" | "light";
};

function routeHasTwoLanguageVariants(pathname: string): boolean {
  return pathname === "/" || /^\/(en|el)\/?$/.test(pathname);
}

const pillShellDark =
  "inline-flex items-center rounded-full border border-slate-200/20 bg-slate-900/30 p-1 backdrop-blur";
const pillShellLight =
  "inline-flex items-center rounded-full border border-ink-200 bg-white/80 p-1 shadow-sm backdrop-blur";

const pillLinkDark =
  "inline-flex rounded-full px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70 hover:text-slate-50";
const pillLinkLight =
  "inline-flex rounded-full px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-clinical-50 hover:text-clinical-700";

const focusRingDark =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";
const focusRingLight =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50";

export function MarketingFooter({
  className = "mx-auto w-full max-w-6xl pb-24 pt-4 sm:pb-16 lg:pb-12",
  forceHideLanguageSwitcher = false,
  variant = "dark",
}: MarketingFooterProps) {
  const pathname = usePathname();
  const showLanguageSwitcher =
    !forceHideLanguageSwitcher && routeHasTwoLanguageVariants(pathname);
  const isLight = variant === "light";
  const pillShell = isLight ? pillShellLight : pillShellDark;
  const pillLink = isLight ? pillLinkLight : pillLinkDark;
  const focusRing = isLight ? focusRingLight : focusRingDark;
  const borderTop = isLight ? "border-ink-200" : "border-slate-800/60";

  return (
    <section className={className} data-testid="marketing-footer">
      <div className={`border-t ${borderTop} pt-5`}>
        <div className="flex flex-wrap items-center justify-start gap-2">
          <div className={pillShell}>
            <PendingLink href="/finder" className={pillLink}>
              Find a Professional
            </PendingLink>
          </div>

          <div className={pillShell}>
            <Link href="/" className={pillLink}>
              About DocCy
            </Link>
          </div>

          <div className={pillShell}>
            <Link href="/blog" className={pillLink}>
              Blog
            </Link>
          </div>

          <div className={pillShell}>
            <button
              type="button"
              onClick={() => emitOpenFeedback()}
              className={`${pillLink} ${focusRing}`}
            >
              Support
            </button>
          </div>

          <div className={pillShell}>
            <a
              href="https://www.instagram.com/doccy_cyprus?igsh=MW94Zjg1czZ6OXNzaw=="
              target="_blank"
              rel="noopener noreferrer"
              className={`${pillLink} ${focusRing}`}
            >
              Instagram
            </a>
          </div>

          {showLanguageSwitcher ? (
            <div className="inline-flex min-h-10 items-center px-0.5">
              <LanguageSwitcher variant={variant} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
