import type { LucideIcon } from "lucide-react";

/**
 * The small icon chip in front of each section heading on the public profile (preview for the
 * user, 2026-10-14): the same pale teal circle on About, Services & prices, Qualifications and
 * Reviews. Decorative; the heading text says what the section is.
 */
export function ProfileHeadingIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-link sm:h-10 sm:w-10"
    >
      <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
    </span>
  );
}
