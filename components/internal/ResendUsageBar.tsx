const RESEND_USAGE_URL = "https://resend.com/settings/usage";

export function ResendUsageBar() {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-slate-300">Resend usage · not from API</p>
        <a
          href={RESEND_USAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-900 transition hover:bg-white"
        >
          Open Resend Usage →
        </a>
      </div>
    </div>
  );
}
