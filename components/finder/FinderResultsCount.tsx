type FinderResultsCountProps = {
  count: number;
  hasActiveFilters: boolean;
  districtLabel?: string;
  specialtyLabel?: string;
  activeName?: string;
  townLabel?: string;
  className?: string;
  variant?: "default" | "footer" | "bar";
};

function buildFilterHint(props: FinderResultsCountProps): string | null {
  const { districtLabel, specialtyLabel, activeName, townLabel } = props;
  const parts: string[] = [];
  if (districtLabel) parts.push(districtLabel);
  if (townLabel?.trim()) parts.push(townLabel.trim());
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
  const onBar = variant === "bar";
  const resolvedClassName =
    className ??
    (onBar
      ? "mt-3 text-xs leading-relaxed text-white/75"
      : variant === "footer"
        ? "mt-4 text-xs leading-relaxed text-ink-400"
        : "mb-4 text-sm leading-relaxed text-ink-500");
  const countClassName = onBar
    ? "font-medium tabular-nums text-white"
    : variant === "footer"
      ? "font-medium tabular-nums text-ink-500"
      : hasActiveFilters
        ? "font-semibold tabular-nums text-ink-800"
        : "font-semibold tabular-nums text-clinical-600";
  const hintMutedClass = onBar ? "text-white/65" : "text-ink-400";
  const hintStrongClass = onBar ? "text-white/85" : "text-ink-500";

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
            <span className={hintMutedClass}>
              {" "}
              · <span className={hintStrongClass}>{filterHint}</span>
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
