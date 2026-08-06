import { PendingLink } from "@/components/navigation/PendingLink";
import { CLINICS_SEARCH_BASE } from "@/lib/clinics-public-path";

type FinderAudienceToggleProps = {
  active: "professionals" | "clinics";
  className?: string;
};

export function FinderAudienceToggle({
  active,
  className = "",
}: FinderAudienceToggleProps) {
  const professionalsActive = active === "professionals";
  const clinicsActive = active === "clinics";

  return (
    <div
      role="tablist"
      aria-label="Search type"
      data-testid="finder-audience-toggle"
      className={`inline-flex rounded-full border border-clinical-200 bg-clinical-50 p-1 ${className}`.trim()}
    >
      <PendingLink
        href="/"
        aria-current={professionalsActive ? "page" : undefined}
        className={`inline-flex min-h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
          professionalsActive
            ? "bg-white text-clinical-800 shadow-sm"
            : "text-clinical-700 hover:bg-white/70 hover:text-clinical-800"
        }`}
      >
        Professionals
      </PendingLink>
      <PendingLink
        href={CLINICS_SEARCH_BASE}
        aria-current={clinicsActive ? "page" : undefined}
        className={`inline-flex min-h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
          clinicsActive
            ? "bg-white text-clinical-800 shadow-sm"
            : "text-clinical-700 hover:bg-white/70 hover:text-clinical-800"
        }`}
      >
        Clinics
      </PendingLink>
    </div>
  );
}
