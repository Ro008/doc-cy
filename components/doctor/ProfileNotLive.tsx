import { Stethoscope, UserRound } from "lucide-react";
import { PendingLink } from "@/components/navigation/PendingLink";

export type PublicProfileBlockReason = "pending" | "rejected";

type Props = {
  doctorName: string;
  /** Why the public profile is not available (default: pending / under review). */
  verificationStatus?: PublicProfileBlockReason;
};

/**
 * Public message when a doctor row exists but is not verified for public booking.
 */
export function ProfileNotLive({
  doctorName,
  verificationStatus = "pending",
}: Props) {
  const isRejected = verificationStatus === "rejected";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-14 text-slate-200 sm:py-20">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/[0.07] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-sky-500/[0.05] blur-3xl" />
      </div>

      <div className="mx-auto max-w-xl text-center">
        <p
          aria-label="DocCy"
          className="text-xs tracking-[0.16em]"
        >
          <span className="font-semibold text-emerald-300">Doc</span>
          <span className="font-bold text-emerald-500">Cy</span>
        </p>
        <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {isRejected ? "Profile unavailable" : "Profile under review"}
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          You&apos;re on the page for{" "}
          <span className="font-medium text-slate-200">{doctorName}</span>.
        </p>

        {isRejected ? (
          <p className="mt-6 text-left text-sm leading-relaxed text-slate-300 sm:text-center">
            This profile cannot be shown for public booking on DocCy. If you think this is a
            mistake, the professional may contact support to discuss their application.
          </p>
        ) : (
          <p className="mt-6 text-left text-sm leading-relaxed text-slate-300 sm:text-center">
            This professional has applied to join DocCy. We verify credentials before anyone can
            book here — that&apos;s why you&apos;re seeing this message instead of a live profile.
            If everything is in order, the page will usually go live within the{" "}
            <strong className="font-medium text-slate-100">next few hours</strong>.
          </p>
        )}

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          What would you like to do?
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-slate-800/90 bg-slate-900/50 p-5 text-left shadow-lg shadow-black/20 backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <Stethoscope className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-white">I&apos;m the professional</h2>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">
              Log in to your DocCy account to check your agenda, update details, or see your
              verification status.
            </p>
            <PendingLink
              href="/login"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Log in
            </PendingLink>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-800/90 bg-slate-900/50 p-5 text-left shadow-lg shadow-black/20 backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
              <UserRound className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-white">I want to book</h2>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">
              Browse other verified professionals on DocCy, or try this link again once the profile is
              live.
            </p>
            <button
              type="button"
              disabled
              title="Coming soon"
              aria-disabled="true"
              className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-700 bg-slate-800/25 py-2.5 text-sm font-semibold text-slate-400"
            >
              Find a professional
            </button>
            <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
              Directory coming soon
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
