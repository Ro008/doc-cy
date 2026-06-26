export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { DoctorAccountReviewScreen } from "@/components/doctor/DoctorAccountReviewScreen";
import {
  getDoctorRejectionKind,
  isDoctorVerifiedForProduct,
  normalizeDoctorVerificationStatus,
} from "@/lib/doctor-account-access";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";

export default async function DoctorAccountReviewPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=/agenda/account-review");
  }

  const { data: doctor, error: doctorError } = await supabase
    .from("doctors")
    .select("id, name, status, is_specialty_approved")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorError) {
    console.error("[account-review] doctor lookup failed", doctorError);
  }

  if (!doctor) {
    return (
      <main className="min-h-screen bg-ink-900 px-4 py-14 text-slate-200">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-sm text-slate-300">
            Professional profile not found for this account. Please contact support.
          </p>
        </div>
      </main>
    );
  }

  if (isDoctorVerifiedForProduct(doctor.status)) {
    redirect("/agenda");
  }

  const verificationStatus = normalizeDoctorVerificationStatus(doctor.status);
  if (verificationStatus === "verified") {
    redirect("/agenda");
  }
  const rejectionKind = getDoctorRejectionKind({
    status: doctor.status,
    is_specialty_approved: (doctor as { is_specialty_approved?: boolean | null })
      .is_specialty_approved,
  });

  return (
    <DoctorAccountReviewScreen
      doctorName={doctorDashboardDisplayName(doctor.name)}
      verificationStatus={verificationStatus}
      rejectionKind={rejectionKind}
    />
  );
}
