/**
 * Instant placeholders for the doctor pages (route `loading.tsx` files), so a tab
 * click shows the page's shape right away while its data loads.
 */

function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`rounded-xl bg-[linear-gradient(90deg,rgba(30,41,59,0.7)_0%,rgba(51,65,85,0.95)_50%,rgba(30,41,59,0.7)_100%)] bg-[length:200%_100%] motion-safe:animate-shimmer ${className}`}
    />
  );
}

function SkeletonPage({
  label,
  maxWidth,
  children,
}: {
  label: string;
  maxWidth: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-ink-900 text-slate-50">
      <div
        data-testid="page-skeleton"
        role="status"
        aria-busy="true"
        className={`mx-auto flex w-full flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8 ${maxWidth}`}
      >
        <span className="sr-only">Loading {label}…</span>
        {children}
      </div>
    </main>
  );
}

function TitleBlock({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-2">
        <Bone className="h-4 w-36" />
        <Bone className="h-8 w-72 max-w-full" />
      </div>
      {withAction ? <Bone className="h-11 w-36 rounded-xl" /> : null}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonPage label="dashboard" maxWidth="max-w-6xl">
      <TitleBlock withAction />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Bone className="h-7 w-48" />
          <div className="space-y-px overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/70">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4 px-5 py-4">
                <div className="w-20 space-y-2">
                  <Bone className="h-3 w-16" />
                  <Bone className="h-6 w-14" />
                </div>
                <div className="flex-1 space-y-2">
                  <Bone className="h-4 w-44" />
                  <Bone className="h-3 w-64 max-w-full" />
                  <div className="flex gap-2 pt-2">
                    <Bone className="h-10 w-24" />
                    <Bone className="h-10 w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Bone className="h-7 w-40" />
          <div className="space-y-5 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Bone className="h-3.5 w-3.5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-3 w-24" />
                  <Bone className="h-4 w-40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}

export function AgendaSkeleton() {
  return (
    <SkeletonPage label="agenda" maxWidth="max-w-[1920px]">
      <Bone className="h-8 w-56" />
      <div className="flex flex-wrap items-center gap-3">
        <Bone className="h-9 w-40" />
        <Bone className="h-9 w-24" />
        <Bone className="h-9 w-9" />
        <Bone className="h-9 w-9" />
      </div>
      <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-3 rounded-3xl border border-slate-700 bg-slate-950 p-4">
        <div className="space-y-12 pt-10">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Bone key={i} className="h-3 w-10" />
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((col) => (
          <div key={col} className="space-y-3">
            <Bone className="mx-auto h-8 w-12" />
            <Bone className="h-[26rem] w-full rounded-2xl opacity-60" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}

export function SettingsSkeleton() {
  return (
    <SkeletonPage label="settings" maxWidth="max-w-5xl">
      <div className="space-y-3">
        <Bone className="h-3 w-20" />
        <Bone className="h-9 w-64 max-w-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-4 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <Bone className="h-5 w-44" />
          <Bone className="h-10 w-full" />
          <Bone className="h-10 w-2/3" />
        </div>
      ))}
    </SkeletonPage>
  );
}

export function InsightsSkeleton() {
  return (
    <SkeletonPage label="insights" maxWidth="max-w-4xl">
      <div className="space-y-3">
        <Bone className="h-8 w-60" />
        <Bone className="h-4 w-96 max-w-full" />
      </div>
      <Bone className="h-40 w-full rounded-3xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bone className="h-64 rounded-2xl" />
        <Bone className="h-64 rounded-2xl" />
      </div>
    </SkeletonPage>
  );
}

/** Request review / awaiting-patient card (distraction-free, no nav). */
export function ReviewSkeleton() {
  return (
    <main className="min-h-screen bg-ink-900 text-ink-50">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div
          data-testid="page-skeleton"
          role="status"
          aria-busy="true"
          className="space-y-6 rounded-3xl border border-clinical-100/10 bg-ink-900/70 p-6 shadow-2xl shadow-ink-900/50 sm:p-8"
        >
          <span className="sr-only">Loading request…</span>
          <div className="space-y-3">
            <Bone className="h-3 w-44" />
            <Bone className="h-7 w-80 max-w-full" />
            <Bone className="h-4 w-56" />
          </div>
          <Bone className="h-20 w-full rounded-2xl" />
          <div className="flex gap-2">
            <Bone className="h-9 w-16" />
            <Bone className="h-9 w-16" />
            <Bone className="h-9 w-16" />
            <Bone className="h-9 w-16" />
          </div>
          <Bone className="h-28 w-full rounded-2xl" />
          <Bone className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
