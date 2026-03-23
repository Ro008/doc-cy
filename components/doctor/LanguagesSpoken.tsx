import { languageToChip } from "@/lib/language-chips";

type LanguagesSpokenProps = {
  languages: string[] | null | undefined;
  className?: string;
};

export function LanguagesSpoken({ languages, className = "" }: LanguagesSpokenProps) {
  const list = (languages ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  if (list.length === 0) {
    return null;
  }

  const items = list.map((raw, i) => languageToChip(raw, i));

  return (
    <div
      role="region"
      aria-label="Languages spoken by this professional"
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-1.5 ${className}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
        Speaks
      </span>
      <ul className="flex flex-wrap gap-1.5" aria-label="Language list">
        {items.map(({ label, pillClass }, i) => (
          <li key={`${label}-${i}`}>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold leading-snug ${pillClass}`}
            >
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
