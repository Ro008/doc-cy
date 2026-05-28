import { Clock, ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SupportInquiryLink } from "@/components/landing/SupportInquiryLink";
import type { DoctorRejectionKind, DoctorVerificationStatus } from "@/lib/doctor-account-access";

type Props = {
  doctorName: string;
  verificationStatus: Exclude<DoctorVerificationStatus, "verified">;
  rejectionKind?: DoctorRejectionKind | null;
};

const SUPPORT_FEEDBACK = { subject: "Application review inquiry" } as const;

/**
 * Logged-in doctor view while license verification is not complete.
 * No agenda, settings, or insights — account review only.
 */
export function DoctorAccountReviewScreen({
  doctorName,
  verificationStatus,
  rejectionKind = null,
}: Props) {
  const isRejected = verificationStatus === "rejected";
  const isSpecialtyRejected = isRejected && rejectionKind === "specialty";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-14 text-slate-200 sm:py-20">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/[0.07] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-sky-500/[0.05] blur-3xl" />
      </div>

      <div className="mx-auto max-w-lg text-center">
        <p aria-label="DocCy" className="text-xs tracking-[0.16em]">
          <span className="font-semibold text-emerald-300">Doc</span>
          <span className="font-bold text-emerald-500">Cy</span>
        </p>

        <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800/90 bg-slate-900/60 text-emerald-300">
          {isRejected ? (
            <ShieldCheck className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          ) : (
            <Clock className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          )}
        </div>

        <h1 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {isSpecialtyRejected
            ? "Specialty not accepted"
            : isRejected
              ? "Application not approved"
              : "Account under review"}
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Signed in as{" "}
          <span className="font-medium text-slate-200">{doctorName}</span>
        </p>

        {isSpecialtyRejected ? (
          <p className="mt-6 text-left text-sm leading-relaxed text-slate-300 sm:text-center">
            We reviewed the specialty on your application and cannot include it on DocCy at
            this time. Your account stays closed — we did not proceed with license verification.
            If you think we misunderstood your practice, use our{" "}
            <SupportInquiryLink
              label="support form"
              feedbackDetail={SUPPORT_FEEDBACK}
            />
            .
          </p>
        ) : isRejected ? (
          <p className="mt-6 text-left text-sm leading-relaxed text-slate-300 sm:text-center">
            We could not verify your professional license for DocCy. Your agenda and settings
            stay closed. If you believe this is a mistake, use our{" "}
            <SupportInquiryLink
              label="support form"
              feedbackDetail={SUPPORT_FEEDBACK}
            />
            .
          </p>
        ) : (
          <>
            <p className="mt-6 text-left text-sm leading-relaxed text-slate-300 sm:text-center">
              Thank you for applying to DocCy. Our team is reviewing your application — including
              your specialty and professional license — before you can use your agenda, settings,
              or public profile. This usually takes{" "}
              <strong className="font-medium text-slate-100">a few hours</strong>. We will email
              you when your account is ready.
            </p>
            <p className="mt-4 text-left text-xs leading-relaxed text-slate-500 sm:text-center">
              Until then, DocCy stays closed for your account — no bookings, calendar, or
              practice settings.
            </p>
          </>
        )}

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <SignOutButton
            className="w-full justify-center px-4 py-2.5 sm:w-auto"
            data-testid="account-review-sign-out"
          />
        </div>
      </div>
    </main>
  );
}
