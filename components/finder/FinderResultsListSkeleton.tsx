import { finderResultCardClass } from "@/components/finder/finder-surface";

type FinderResultsListSkeletonProps = {
  count?: number;
};

export function FinderResultsListSkeleton({
  count = 5,
}: FinderResultsListSkeletonProps) {
  return (
    <div
      className="mt-6 flex flex-col gap-4"
      data-testid="finder-results-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Updating results...</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={finderResultCardClass} aria-hidden>
          <div className="flex items-start gap-3">
            <div className="h-[72px] w-[72px] shrink-0 animate-pulse rounded-full bg-ink-100" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-ink-50" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-ink-50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
