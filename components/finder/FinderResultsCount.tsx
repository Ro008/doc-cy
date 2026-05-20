type FinderResultsCountProps = {
  count: number;
  hasActiveFilters: boolean;
  districtLabel?: string;
  specialtyLabel?: string;
  activeName?: string;
};

function buildFilterHint(props: FinderResultsCountProps): string | null {
  const { districtLabel, specialtyLabel, activeName } = props;
  const parts: string[] = [];
  if (districtLabel) parts.push(districtLabel);
  if (specialtyLabel) parts.push(specialtyLabel);
  if (activeName?.trim()) parts.push(`“${activeName.trim()}”`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function FinderResultsCount(props: FinderResultsCountProps) {
  const { count, hasActiveFilters } = props;
  if (count <= 0) return null;

  const professionalWord = count === 1 ? "professional" : "professionals";
  const filterHint = buildFilterHint(props);

  return (
    <p
      data-testid="finder-results-count"
      className="mb-4 text-sm leading-relaxed text-slate-400"
      aria-live="polite"
    >
      {hasActiveFilters ? (
        <>
          Showing{" "}
          <span className="font-semibold tabular-nums text-slate-200">{count}</span>{" "}
          {professionalWord}
          {filterHint ? (
            <span className="text-slate-500">
              {" "}
              · <span className="text-slate-400">{filterHint}</span>
            </span>
          ) : null}
        </>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-emerald-200/95">{count}</span> health{" "}
          {professionalWord} on DocCy across Cyprus
        </>
      )}
    </p>
  );
}
