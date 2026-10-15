import { canonicalLanguageLabel } from "@/lib/cyprus-languages";
import { LANGUAGE_CHIP_ON_LIGHT } from "@/lib/language-chips";

type FinderCardLanguagesProps = {
  languages: string[];
  /** Unset shows every language (user, 2026-10-15: the finder card lists them all). */
  maxVisible?: number;
  className?: string;
};

export function FinderCardLanguages({
  languages,
  maxVisible,
  className = "",
}: FinderCardLanguagesProps) {
  return (
    <div className={className} data-testid="finder-card-languages">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
        Speaks
      </p>
      {languages.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {(maxVisible != null ? languages.slice(0, maxVisible) : languages).map((language, index) => {
            const label = canonicalLanguageLabel(language);
            return (
              <span
                key={`${label}-${index}`}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-snug ${LANGUAGE_CHIP_ON_LIGHT}`}
                title={label}
              >
                <span>{label}</span>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-ink-400">Not specified</p>
      )}
    </div>
  );
}
