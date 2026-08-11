export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createPracticeInsightsTranslator } from "@/lib/practice-insights-i18n";
import { PracticeInsightsDashboard } from "@/components/dashboard/PracticeInsightsDashboard";
import { FoundingMemberBadge } from "@/components/dashboard/FoundingMemberBadge";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import {
  buildWeeklyScheduleFromSettings,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import { buildPracticeInsights } from "@/lib/practice-insights";
import { isFounderSubscriptionTier } from "@/lib/subscription-tier";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

export default async function PracticeInsightsPage() {
  const t = createPracticeInsightsTranslator();
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const doctorRes = await supabase
    .from("doctors")
    .select("id, name, subscription_tier")
    .eq("auth_user_id", user.id)
    .single();

  if (doctorRes.error || !doctorRes.data) {
    redirect("/agenda");
  }

  const doctor = doctorRes.data;

  const { data: appointments } = await fetchAllSupabaseRows(() =>
    supabase
      .from("appointments")
      .select(
        "appointment_datetime, status, created_at, is_new_patient, attendance, duration_minutes",
      )
      .eq("doctor_id", doctor.id),
  );

  let weeklySchedule = null;
  const settingsRes = await supabase
    .from("doctor_settings")
    .select(
      "doctor_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule",
    )
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  if (!settingsRes.error && settingsRes.data) {
    weeklySchedule = buildWeeklyScheduleFromSettings(
      settingsRes.data as DoctorSettingsRow,
    );
  }

  const insights = buildPracticeInsights(
    (appointments ?? []) as {
      appointment_datetime: string;
      status: string;
      created_at: string | null;
      is_new_patient: boolean | null;
      attendance: string | null;
      duration_minutes: number | null;
    }[],
    weeklySchedule,
  );

  const displayName = doctorDashboardDisplayName(doctor.name);
  const isFoundingMember = isFounderSubscriptionTier(
    (doctor as { subscription_tier?: string | null }).subscription_tier,
  );

  return (
    <main className="min-h-screen bg-ink-900 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <header className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              {t("pageTitle")}
            </h1>
            {isFoundingMember ? <FoundingMemberBadge /> : null}
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            {t("pageSubtitle", { name: displayName })}
          </p>
        </header>

        <PracticeInsightsDashboard insights={insights} />
      </div>
    </main>
  );
}
