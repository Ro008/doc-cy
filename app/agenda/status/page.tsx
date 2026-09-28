import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { SignOutOnMount } from "@/components/auth/SignOutOnMount";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  REGISTRATION_STATUS_PATH,
  loadRegistrationStatus,
  type RegistrationStatus,
} from "@/lib/registration-status";

export const dynamic = "force-dynamic";

function cyprusDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Nicosia",
  }).format(new Date(iso));
}

/**
 * The only page an applicant sees while their registration is pending or after it
 * was denied (the middleware sends every other /agenda page here).
 */
export default async function RegistrationStatusPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(REGISTRATION_STATUS_PATH)}`);

  const service = createServiceRoleClient();
  let status: RegistrationStatus = { kind: "none" };
  let isAdmin = false;
  if (service) {
    const { data: professional } = await service
      .from("professionals")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (professional?.id) redirect("/agenda");
    try {
      status = await loadRegistrationStatus(service, user.id);
    } catch (error) {
      console.error("[DocCy] registration status failed", error);
    }
    if (status.kind === "none") {
      const { data: adminRow } = await service
        .from("admin_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      isAdmin = Boolean(adminRow?.id);
    }
  }
  // No profile and no application: not kept signed in (user, 2026-09-28). A founder's
  // login is exempt: signing it out would also end the dashboard session in this browser.
  const signOutNow = status.kind === "none" && !isAdmin;

  return (
    <main className="min-h-screen bg-ink-900 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-4 py-10">
        <header className="flex items-center justify-between">
          <DocCyWordmark size="lg" />
          {signOutNow ? <SignOutOnMount /> : <SignOutButton />}
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          {status.kind === "confirm_email" ? (
            <>
              <h1 className="text-xl font-semibold">Confirm your email to send your application</h1>
              <p className="text-slate-300">
                We sent a link to <strong>{user.email}</strong> in the email &ldquo;We received your
                application&rdquo;. Open it to confirm your address: your application then goes to our team for
                review.
              </p>
              <p className="text-sm text-slate-400">
                Can&apos;t find it? Check your spam folder. An application that isn&apos;t confirmed within 7 days is
                deleted, and you can register again.
              </p>
            </>
          ) : status.kind === "pending" ? (
            <>
              <h1 className="text-xl font-semibold">Your application is under review</h1>
              <p className="text-slate-300">
                We received it on {cyprusDate(status.submittedAt)}. Our team checks every registration by hand,
                including your licence numbers and clinics. We&apos;ll email you at <strong>{user.email}</strong> as
                soon as it&apos;s decided.
              </p>
              <p className="text-sm text-slate-400">
                Your agenda and settings open once your profile is approved.
              </p>
            </>
          ) : status.kind === "denied" ? (
            <>
              <h1 className="text-xl font-semibold">Your application was not approved</h1>
              <p className="text-slate-300">Decided on {cyprusDate(status.decidedAt)}. The reason:</p>
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-red-100">{status.reason}</p>
              <p className="text-slate-300">
                You can apply again with this account once you&apos;ve fixed it. Your new application goes to our
                team straight away.
              </p>
              <Link
                href="/register"
                className="inline-flex rounded-xl bg-clinical-600 px-4 py-2 font-semibold text-white hover:bg-clinical-500"
              >
                Apply again
              </Link>
            </>
          ) : status.kind === "withdrawn" ? (
            <>
              <h1 className="text-xl font-semibold">Your application was withdrawn</h1>
              <p className="text-slate-300">You can apply again with this account whenever you&apos;re ready.</p>
              <Link
                href="/register"
                className="inline-flex rounded-xl bg-clinical-600 px-4 py-2 font-semibold text-white hover:bg-clinical-500"
              >
                Apply again
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">No professional profile yet</h1>
              <p className="text-slate-300">
                This account ({user.email}) has no DocCy profile or application. Register as a professional to get
                started.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex rounded-xl bg-clinical-600 px-4 py-2 font-semibold text-white hover:bg-clinical-500"
                >
                  Join as a professional
                </Link>
                <Link
                  href="/finder"
                  className="inline-flex rounded-xl border border-slate-700 px-4 py-2 font-semibold text-slate-200 hover:border-clinical-400/50 hover:text-clinical-200"
                >
                  Back to the finder
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
