import { cookies } from "next/headers";
import { FinderLoadMoreLoadingGate } from "@/components/finder/FinderLoadMoreLoadingGate";
import { FinderPublicHeader } from "@/components/finder/FinderPublicHeader";
import { FinderResultsListSkeleton } from "@/components/finder/FinderResultsListSkeleton";
import { isProSessionHintValue, PRO_SESSION_HINT_COOKIE } from "@/lib/pro-session-hint";

/** Destination fallback while a district / clinics search page streams in. */
export default function FinderSearchRouteLoading({
  proSessionHint,
}: {
  proSessionHint?: boolean;
} = {}) {
  const hideGuestCtas =
    proSessionHint ??
    isProSessionHintValue(cookies().get(PRO_SESSION_HINT_COOKIE)?.value);

  return (
    <FinderLoadMoreLoadingGate>
      <main className="min-h-screen bg-ink-50 text-ink-800">
        <FinderPublicHeader proSessionHint={hideGuestCtas} />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 h-10 w-64 max-w-full animate-pulse rounded-lg bg-ink-100" />
          <FinderResultsListSkeleton />
        </div>
      </main>
    </FinderLoadMoreLoadingGate>
  );
}
