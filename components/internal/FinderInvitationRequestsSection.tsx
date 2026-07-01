"use client";

export type FinderInvitationRequestRow = {
  requestedName: string;
  specialty: string | null;
  district: string | null;
  count: number;
  lastAt: string;
};

type Props = {
  rows: FinderInvitationRequestRow[];
};

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function FinderInvitationRequestsSection({ rows }: Props) {
  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 sm:p-5">
      <div className="border-b border-emerald-500/20 pb-4">
        <h2 className="text-sm font-semibold text-emerald-100">
          Finder: patients looking for unlisted professionals
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-emerald-100/80">
          Free-text names from the finder empty state — rows in{" "}
          <code className="rounded bg-black/30 px-1">finder_doctor_invitation_requests</code>. Use
          this list to decide who to add to the manual directory next (separate from online-booking
          vote podium above).
        </p>
        <p className="mt-2 text-[11px] font-medium text-emerald-200/90">
          Showing: <span className="text-emerald-50">Last 90 days</span>
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="relative mt-5 -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto overflow-y-visible scroll-smooth overscroll-x-contain px-4 pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:max-w-none sm:px-0">
          <table className="w-full min-w-[480px] text-left text-xs sm:min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-700/80 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <th className="py-2 pr-2 sm:pr-3">Name requested</th>
                <th className="py-2 pr-2 sm:pr-3">Specialty</th>
                <th className="py-2 pr-2 sm:pr-3">District filter</th>
                <th className="py-2 pr-2 text-right sm:pr-3">Requests</th>
                <th className="py-2 text-right">Last request</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.requestedName}|${row.specialty ?? ""}|${row.district ?? ""}`}
                  className="border-b border-slate-800/60 text-slate-200"
                >
                  <td
                    className="max-w-[160px] truncate py-2.5 pr-2 font-medium text-slate-100 sm:max-w-[220px] sm:py-2 sm:pr-3"
                    title={row.requestedName}
                  >
                    {row.requestedName}
                  </td>
                  <td
                    className="max-w-[120px] truncate py-2.5 pr-2 text-slate-300 sm:max-w-[160px] sm:py-2 sm:pr-3"
                    title={row.specialty ?? ""}
                  >
                    {row.specialty ?? "—"}
                  </td>
                  <td className="max-w-[100px] truncate py-2.5 pr-2 text-slate-400 sm:py-2 sm:pr-3">
                    {row.district ?? "—"}
                  </td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-emerald-200 sm:py-2 sm:pr-3">
                    {row.count}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right text-slate-500 sm:py-2">
                    {formatShortDate(row.lastAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 text-xs text-slate-400">
          No missing-doctor requests in the last 90 days yet. They appear when patients use the
          finder empty-state card.
        </p>
      )}
    </section>
  );
}
