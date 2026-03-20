export default function BookingSuccessLoading() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="rounded-3xl border border-emerald-200/20 bg-slate-900/60 p-8 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl sm:p-10">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-400/20 border-t-emerald-400"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold text-slate-50">
              Confirming your appointment...
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-slate-300">
              We&apos;re preparing your confirmation details. Please wait a moment.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

