import { PendingLink } from "@/components/navigation/PendingLink";
import { CLINICS_SEARCH_BASE } from "@/lib/clinics-public-path";

type FinderAudienceToggleProps = {
  active: "professionals" | "clinics";
  className?: string;
  /** `bar` = on the clinical full-bleed search strip. */
  variant?: "default" | "bar";
};

export function FinderAudienceToggle({
  active,
  className = "",
  variant = "default",
}: FinderAudienceToggleProps) {
  const professionalsActive = active === "professionals";
  const clinicsActive = active === "clinics";
  const onBar = variant === "bar";

  const shellClass = onBar
    ? "border border-white/25 bg-clinical-700/40"
    : "border border-site-clinical-200 bg-site-clinical-50";
  const activeClass = "bg-site-white text-site-clinical-800 shadow-sm";
  const inactiveClass = onBar
    ? "text-white/85 hover:bg-white/10 hover:text-white"
    : "text-site-clinical-700 hover:bg-white/70 hover:text-site-clinical-800";

  return (
    <div
      role="tablist"
      aria-label="Search type"
      data-testid="finder-audience-toggle"
      className={`inline-flex rounded-full p-1 ${shellClass} ${className}`.trim()}
    >
      <PendingLink
        href="/"
        aria-current={professionalsActive ? "page" : undefined}
        className={`inline-flex min-h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
          professionalsActive ? activeClass : inactiveClass
        }`}
      >
        Professionals
      </PendingLink>
      <PendingLink
        href={CLINICS_SEARCH_BASE}
        aria-current={clinicsActive ? "page" : undefined}
        className={`inline-flex min-h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
          clinicsActive ? activeClass : inactiveClass
        }`}
      >
        Clinics
      </PendingLink>
    </div>
  );
}
