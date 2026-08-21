import { FinderSpecialtyLink } from "@/components/finder/FinderSpecialtyLink";
import { harmonizeFinderSpecialtyList } from "@/lib/finder-specialty-harmonize";

const PILL_CLASS =
  "inline-flex max-w-full items-center rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-600 transition-none hover:border-clinical-300 hover:bg-clinical-50 hover:text-clinical-800";

type FinderSpecialtyPillsProps = {
  specialties: readonly string[];
  /** Fallback when specialties is empty. */
  specialty?: string | null;
  district?: string | null;
  className?: string;
};

/**
 * One clickable pill per specialty (never a combined "A · B" filter link).
 */
export function FinderSpecialtyPills({
  specialties,
  specialty,
  district = null,
  className,
}: FinderSpecialtyPillsProps) {
  const parts = harmonizeFinderSpecialtyList(
    specialties.length > 0
      ? specialties
      : [String(specialty ?? "").trim()].filter(Boolean),
  );

  if (parts.length === 0) {
    return (
      <span className={className}>
        <span className={PILL_CLASS}>Specialty not set</span>
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`.trim()}>
      {parts.map((label) => (
        <FinderSpecialtyLink
          key={label}
          specialty={label}
          district={district}
          className={PILL_CLASS}
        >
          <span className="whitespace-normal break-words leading-snug">{label}</span>
        </FinderSpecialtyLink>
      ))}
    </div>
  );
}
