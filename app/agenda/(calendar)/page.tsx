export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { AgendaRealtime } from "@/components/agenda/AgendaRealtime";
import { FoundingMemberBadge } from "@/components/dashboard/FoundingMemberBadge";
import { FirstLoginTrialNoticeGate } from "@/components/dashboard/FirstLoginTrialNoticeGate";
import { isFounderSubscriptionTier } from "@/lib/subscription-tier";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import {
  DOCTOR_FIRST_LOGIN_PATH,
  shouldRedirectFirstLoginToSettings,
} from "@/lib/first-login-trial-notice";
import { loadAgendaSettings } from "@/lib/load-agenda-settings";
import { parseAgendaHighlight } from "@/lib/agenda-highlight";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import {
  AGENDA_APPOINTMENT_SELECT,
  locationsToAgendaClinics,
} from "@/lib/agenda-clinics";

type AgendaPageProps = {
  searchParams?: {
    date?: string;
    view?: string;
    manual?: string;
    highlight?: string;
  };
};

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  let doctorRes = await supabase
    .from("professionals")
    .select("id, name, status, auth_user_id, slug, subscription_tier, trial_notice_seen_at")
    .eq("auth_user_id", user.id)
    .single();

  const tierMissingAgenda =
    doctorRes.error &&
    (String(doctorRes.error.message ?? "")
      .toLowerCase()
      .includes("subscription_tier") ||
      (doctorRes.error as { code?: string }).code === "42703");

  if (tierMissingAgenda) {
    doctorRes = await supabase
      .from("professionals")
      .select("id, name, status, auth_user_id, slug, trial_notice_seen_at")
      .eq("auth_user_id", user.id)
      .single();
  }

  if (
    doctorRes.error &&
    String(doctorRes.error.message ?? "")
      .toLowerCase()
      .includes("trial_notice_seen_at")
  ) {
    doctorRes = await supabase
      .from("professionals")
      .select("id, name, status, auth_user_id, slug, subscription_tier")
      .eq("auth_user_id", user.id)
      .single();
  }

  const doctor = doctorRes.data;
  const doctorError = doctorRes.error;

  if (doctorError) {
    console.error("[Agenda] Error fetching doctor for user", doctorError);
  }

  if (!doctor) {
    return (
      <main className="min-h-screen bg-ink-900 text-slate-50">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-clinical-500/[0.04] via-transparent to-transparent" />
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 py-12 text-center">
          <p className="text-slate-200">
            Professional profile not found for this account. Please contact
            support.
          </p>
        </div>
      </main>
    );
  }

  if (
    shouldRedirectFirstLoginToSettings({
      status: (doctor as { status?: string | null }).status,
      trialNoticeSeenAt: (doctor as { trial_notice_seen_at?: string | null })
        .trial_notice_seen_at,
    })
  ) {
    redirect(DOCTOR_FIRST_LOGIN_PATH);
  }

  const { data: appointments, error } = await fetchAllSupabaseRows(() =>
    supabase
      .from("appointments")
      .select(AGENDA_APPOINTMENT_SELECT)
      .eq("doctor_id", doctor.id)
      .order("appointment_datetime", { ascending: true }),
  );

  if (error) {
    console.error(error);
  }

  const { workingHours } = await loadAgendaSettings(supabase, doctor.id);

  const locationRows = await loadDoctorLocations(doctor.id);
  const clinics = locationsToAgendaClinics(locationRows);

  const displayName = doctorDashboardDisplayName(doctor.name);

  const isFoundingMember = isFounderSubscriptionTier(
    (doctor as { subscription_tier?: string | null }).subscription_tier,
  );

  return (
    <main className="min-h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom,0px))] lg:min-h-[calc(100dvh-57px)] bg-ink-900 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-clinical-500/[0.04] via-transparent to-transparent" />

      <div className="mx-auto flex min-h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom,0px))] lg:min-h-[calc(100dvh-57px)] w-full max-w-[1920px] flex-col gap-3 px-4 py-4 sm:px-6 lg:gap-4 lg:px-8 lg:py-4">
        <header className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
            {displayName}
          </h1>
          {isFoundingMember ? <FoundingMemberBadge compact /> : null}
        </header>

        <FirstLoginTrialNoticeGate />

        <AgendaRealtime
          doctorId={doctor.id}
          doctorSlug={(doctor as { slug?: string | null }).slug ?? null}
          initialAppointments={(appointments as any[]) ?? []}
          workingHours={workingHours}
          clinics={clinics}
          initialDateKey={searchParams?.date ?? null}
          initialView={searchParams?.view ?? null}
          openManualBooking={searchParams?.manual === "1"}
          highlightAppointmentId={parseAgendaHighlight(searchParams?.highlight)}
        />
      </div>
    </main>
  );
}
