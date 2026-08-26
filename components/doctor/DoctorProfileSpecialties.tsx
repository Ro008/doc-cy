import { FinderSpecialtyLink } from "@/components/finder/FinderSpecialtyLink";
import { PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL } from "@/lib/doctor-specialty-public";

const PROFILE_PILL_CLASS =
  "inline-flex max-w-full items-center rounded-full border border-clinical-200 bg-clinical-50 px-3 py-1.5 text-left text-sm font-semibold tracking-wide text-clinical-800 transition hover:border-clinical-400 hover:bg-clinical-100 hover:text-clinical-900";

type DoctorProfileSpecialtiesProps = {
  /** Approved specialty labels (flat, equal weight). */
  specialties: readonly string[];
  /** Single fallback when specialties is empty. */
  specialty?: string | null;
  district?: string | null;
  underReview?: boolean;
  className?: string;
};

/**
 * Profile header specialties: equal-weight clickable pills (no primary hierarchy).
 * Matches finder card language while using a slightly larger profile scale.
 */
export function DoctorProfileSpecialties({
  specialties,
  specialty,
  district = null,
  underReview = false,
  className,
}: DoctorProfileSpecialtiesProps) {
  if (underReview) {
    return (
      <p className={`mt-2 text-base font-medium text-ink-500 sm:text-lg ${className ?? ""}`.trim()}>
        {PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL}
      </p>
    );
  }

  const parts =
    specialties.length > 0
      ? specialties.map((s) => s.trim()).filter(Boolean)
      : [String(specialty ?? "").trim()].filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  return (
    <div
      className={`mt-2.5 flex flex-wrap items-center gap-2 ${className ?? ""}`.trim()}
      aria-label="Specialties"
    >
      {parts.map((label) => (
        <FinderSpecialtyLink
          key={label}
          specialty={label}
          district={district}
          className={PROFILE_PILL_CLASS}
        >
          <span className="whitespace-normal break-words leading-snug">{label}</span>
        </FinderSpecialtyLink>
      ))}
    </div>
  );
}
