import Link from "next/link";
import { settingsSectionHref } from "@/lib/settings-sections";

/**
 * The Founding Member mark (user, 2026-10-01). It names the status and, where it is
 * a link, leads to Settings → Plan & billing, the one place with the terms and real
 * dates; the old pop-up repeated them with a fixed "180 days" and is gone. Pass
 * `href={null}` where it should not link (inside Settings, which lists Plan & billing).
 */
export function FoundingMemberBadge({
  compact = false,
  href = settingsSectionHref("plan"),
}: {
  compact?: boolean;
  href?: string | null;
}) {
  const className = compact
    ? "inline-flex shrink-0 items-center rounded-md border border-clinical-400/50 bg-clinical-400/[0.07] px-2 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-clinical-100 shadow-[0_0_16px_-6px_rgba(18,184,192,0.45)]"
    : "inline-flex shrink-0 items-center rounded-lg border border-clinical-400/50 bg-clinical-400/[0.07] px-3 py-2 text-[10px] font-semibold uppercase leading-none tracking-[0.26em] text-clinical-100 shadow-[0_0_22px_-6px_rgba(18,184,192,0.5)] sm:text-[11px] sm:tracking-[0.3em]";

  if (!href) {
    return (
      <span className={className} data-testid="founding-member-badge">
        Founding Member
      </span>
    );
  }
  return (
    <Link
      href={href}
      data-testid="founding-member-badge"
      title="See your Founding Member terms"
      className={`${className} transition hover:border-clinical-300/75 hover:bg-clinical-400/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900`}
    >
      Founding Member
    </Link>
  );
}
