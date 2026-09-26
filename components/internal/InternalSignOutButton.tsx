/**
 * A plain form POST, so signing out works even before the page's scripts load.
 * The logout route answers a browser form with a redirect to the sign-in page.
 */
export function InternalSignOutButton() {
  return (
    <form method="post" action="/api/internal/logout">
      <button
        type="submit"
        className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
      >
        Sign out
      </button>
    </form>
  );
}
