type FinderResultsCountProps = {
  count: number;
  hasActiveFilters: boolean;
  districtLabel?: string;
  specialtyLabel?: string;
  activeName?: string;
  className?: string;
  variant?: "default" | "footer";
};

function buildFilterHint(props: FinderResultsCountProps): string | null {
  const { districtLabel, specialtyLabel, activeName } = props;
  const parts: string[] = [];
  if (districtLabel) parts.push(districtLabel);
  if (specialtyLabel) parts.push(specialtyLabel);
  if (activeName?.trim()) parts.push(`“${activeName.trim()}”`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function FinderResultsCount({
  className,
  variant = "default",
  ...props
}: FinderResultsCountProps) {
  const { count, hasActiveFilters } = props;
  if (count <= 0) return null;

  const professionalWord = count === 1 ? "professional" : "professionals";
  const filterHint = buildFilterHint(props);
  const resolvedClassName =
    className ??
    (variant === "footer"
      ? "mt-4 border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-400"
      : "mb-4 text-sm leading-relaxed text-ink-500");
  const countClassName =
    variant === "footer"
      ? "font-medium tabular-nums text-ink-500"
      : hasActiveFilters
        ? "font-semibold tabular-nums text-ink-800"
        : "font-semibold tabular-nums text-clinical-600";

  return (
    <p
      data-testid="finder-results-count"
      className={resolvedClassName}
      aria-live="polite"
    >
      {hasActiveFilters ? (
        <>
          Showing{" "}
          <span className={countClassName}>{count}</span>{" "}
          {professionalWord}
          {filterHint ? (
            <span className="text-ink-400">
              {" "}
              · <span className="text-ink-500">{filterHint}</span>
            </span>
          ) : null}
        </>
      ) : (
        <>
          <span className={countClassName}>{count}</span> health {professionalWord} on DocCy across
          Cyprus
        </>
      )}
    </p>
  );
}
