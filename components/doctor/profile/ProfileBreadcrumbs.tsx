import { ChevronRight } from "lucide-react";
import type { ProfileBreadcrumb } from "@/lib/public/profile-breadcrumbs";

/** "Dermatology › Nicosia › Dr. …": back to the finder, as on the big directories. */
export function ProfileBreadcrumbs({
  crumbs,
  ariaLabel,
}: {
  crumbs: readonly ProfileBreadcrumb[];
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {crumbs.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="inline-flex min-w-0 items-center gap-x-1.5">
            {index > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-profile-muted" aria-hidden />
            ) : null}
            {crumb.href ? (
              <a
                href={crumb.href}
                className="font-semibold text-accent-link underline-offset-2 hover:underline"
              >
                {crumb.label}
              </a>
            ) : (
              <span aria-current="page" className="truncate font-semibold text-profile-text">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
