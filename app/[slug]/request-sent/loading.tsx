export default function BookingRequestSentLoading() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="rounded-3xl border border-amber-200/20 bg-slate-900/60 p-8 shadow-2xl shadow-amber-500/10 backdrop-blur-xl sm:p-10">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-amber-400/20 border-t-amber-400"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold text-slate-50">
              Loading your request…
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-slate-300">
              Please wait while we load the details of your booking request.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
