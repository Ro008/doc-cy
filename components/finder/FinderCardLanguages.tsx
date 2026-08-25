import { languageThemeForLabel } from "@/lib/cyprus-languages";

type FinderCardLanguagesProps = {
  languages: string[];
  maxVisible?: number;
  className?: string;
};

export function FinderCardLanguages({
  languages,
  maxVisible = 4,
  className = "",
}: FinderCardLanguagesProps) {
  return (
    <div className={className} data-testid="finder-card-languages">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
        Speaks
      </p>
      {languages.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {languages.slice(0, maxVisible).map((language, index) => {
            const theme = languageThemeForLabel(language);
            return (
              <span
                key={`${theme.label}-${index}`}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-snug ${theme.pillClass}`}
                title={theme.label}
              >
                <span>{theme.label}</span>
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
