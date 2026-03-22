import { languageThemeForLabel } from "@/lib/cyprus-languages";

type Props = {
  languages: string[] | null | undefined;
  className?: string;
  /** Tighter spacing for table cells */
  compact?: boolean;
};

export function LanguageBadgeList({
  languages,
  className = "",
  compact = false,
}: Props) {
  const list = (languages ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  if (list.length === 0) {
    return <span className="text-slate-500">—</span>;
  }

  const gap = compact ? "gap-1" : "gap-1.5";

  return (
    <div className={`flex flex-wrap ${gap} ${className}`}>
      {list.map((raw, i) => {
        const t = languageThemeForLabel(raw);
        return (
          <span
            key={`${t.label}-${i}`}
            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold leading-snug ${t.pillClass}`}
          >
            {t.label}
          </span>
        );
      })}
    </div>
  );
}
