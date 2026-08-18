import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { FinderLoadMoreLoadingGate } from "@/components/finder/FinderLoadMoreLoadingGate";
import { FinderResultsListSkeleton } from "@/components/finder/FinderResultsListSkeleton";

/** Destination fallback while a district / clinics search page streams in. */
export default function FinderSearchRouteLoading() {
  return (
    <FinderLoadMoreLoadingGate>
      <main className="min-h-screen bg-ink-50 text-ink-800">
        <header className="px-4 pt-8 pb-8 sm:px-6 sm:pb-0 lg:px-8">
          <DocCyWordmark variant="light" size="xl" />
        </header>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 h-10 w-64 max-w-full animate-pulse rounded-lg bg-ink-100" />
          <FinderResultsListSkeleton />
        </div>
      </main>
    </FinderLoadMoreLoadingGate>
  );
}
