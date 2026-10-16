import { Fragment } from "react";
import { FinderSpecialtyLink } from "@/components/finder/FinderSpecialtyLink";
import { canonicalLanguageLabel } from "@/lib/cyprus-languages";
import { harmonizeFinderSpecialtyList } from "@/lib/finder-specialty-harmonize";

/**
 * G's specialties line (Finder G, step 4; user, 2026-10-16): "Dentistry · Orthodontics",
 * every specialty, each still a link to its own list (as the pills were).
 */
export function FinderCardSpecialtyLine({
  specialties,
  specialty = null,
  district = null,
}: {
  specialties: readonly string[];
  /** Fallback when specialties is empty. */
  specialty?: string | null;
  district?: string | null;
}) {
  const parts = harmonizeFinderSpecialtyList(
    specialties.length > 0 ? specialties : [String(specialty ?? "").trim()].filter(Boolean),
  );
  return (
    <p data-testid="finder-card-specialties" className="line-clamp-2 text-sm leading-snug text-site-ink-500">
      {parts.length === 0
        ? "Specialty not set"
        : parts.map((label, index) => (
            <Fragment key={label}>
              {index > 0 ? " · " : null}
              <FinderSpecialtyLink
                specialty={label}
                district={district}
                className="transition-none hover:text-site-clinical-700 hover:underline"
              >
                {label}
              </FinderSpecialtyLink>
            </Fragment>
          ))}
    </p>
  );
}

/** "Greek, English, Russian": every language on the card (user, 2026-10-15), as words. */
export function finderCardLanguagesText(languages: readonly string[]): string {
  return languages.map((language) => canonicalLanguageLabel(language)).filter(Boolean).join(", ");
}
