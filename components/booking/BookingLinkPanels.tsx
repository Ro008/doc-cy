import type { ReactNode } from "react";

/**
 * Shared shell for the pages patients open from DocCy emails (/booking/*): one card,
 * the same look as the reschedule link page. Online booking first: every dead end
 * offers the professional's profile calendar.
 */
export function BookingLinkShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-ink-900 px-4 py-12 text-slate-50 sm:py-16">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
      </div>
      {children}
    </main>
  );
}

export function BookingLinkCard({
  title,
  testId,
  children,
}: {
  title: string;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900/70 p-8 text-center"
      data-testid={testId}
    >
      <h1 className="text-xl font-semibold text-slate-50">{title}</h1>
      {children}
    </div>
  );
}

export function BookingLinkText({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-slate-400">{children}</p>;
}

export function BookOnlineButton({ href, label = "Book a time online" }: { href: string | null | undefined; label?: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-clinical-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/25 transition hover:bg-clinical-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300"
    >
      {label}
    </a>
  );
}
