export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { AgendaRealtime } from "@/components/agenda/AgendaRealtime";
import { FoundingMemberBadge } from "@/components/dashboard/FoundingMemberBadge";
import { isFounderSubscriptionTier } from "@/lib/subscription-tier";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import {
  buildWeeklyScheduleFromSettings,
  type DoctorSettingsRow,
  type WeeklySchedule,
} from "@/lib/doctor-settings";

type AgendaWorkingHours = {
  weeklySchedule: WeeklySchedule;
  breakStart: string | null;
  breakEnd: string | null;
  slotDurationMinutes: number;
};

type AgendaPageProps = {
  searchParams?: {
    date?: string;
    manual?: string;
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
    .from("doctors")
    .select("id, name, status, auth_user_id, slug, subscription_tier")
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
      .from("doctors")
      .select("id, name, status, auth_user_id, slug")
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
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        </div>
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 py-12 text-center">
          <p className="text-slate-200">
            Professional profile not found for this account. Please contact
            support.
          </p>
        </div>
      </main>
    );
  }

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, patient_phone, reason, appointment_datetime, status, duration_minutes, proposed_slots, proposal_expires_at",
    )
    .eq("doctor_id", doctor.id)
    .order("appointment_datetime", { ascending: true });

  if (error) {
    console.error(error);
  }

  let workingHours: AgendaWorkingHours | null = null;
  {
    let settingsRes = await supabase
      .from("doctor_settings")
      .select(
        "doctor_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule, break_start, break_end, pause_online_bookings, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours, slot_duration_minutes",
      )
      .eq("doctor_id", doctor.id)
      .single();

    const weeklyMissing =
      settingsRes.error &&
      (String(settingsRes.error.message ?? "")
        .toLowerCase()
        .includes("weekly_schedule") ||
        (settingsRes.error as { code?: string }).code === "42703");

    if (weeklyMissing) {
      settingsRes = await supabase
        .from("doctor_settings")
        .select(
          "doctor_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, break_start, break_end, pause_online_bookings, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours, slot_duration_minutes",
        )
        .eq("doctor_id", doctor.id)
        .single();
    }

    if (!settingsRes.error && settingsRes.data) {
      const s = settingsRes.data as DoctorSettingsRow;
      workingHours = {
        weeklySchedule: buildWeeklyScheduleFromSettings({
          ...s,
          weekly_schedule: s.weekly_schedule ?? null,
        }),
        breakStart: (s.break_start ?? null) as string | null,
        breakEnd: (s.break_end ?? null) as string | null,
        slotDurationMinutes:
          (s as { slot_duration_minutes?: number | null })
            .slot_duration_minutes ?? 30,
      };
    }
  }

  const displayName = doctorDashboardDisplayName(doctor.name);

  const isFoundingMember = isFounderSubscriptionTier(
    (doctor as { subscription_tier?: string | null }).subscription_tier,
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-[1920px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-8">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                {displayName}
              </h1>
              {isFoundingMember ? <FoundingMemberBadge /> : null}
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Weekly calendar on desktop · Daily focus on mobile
            </p>
            {doctor.status !== "verified" && (
              <p className="mt-4 inline-flex max-w-prose items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-100">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                {doctor.status === "rejected"
                  ? "Your application was not approved for a public profile. Contact support if you need help."
                  : "Your public profile is under review. We’ll notify you when it’s verified."}
              </p>
            )}
          </div>
        </header>

        <AgendaRealtime
          doctorId={doctor.id}
          doctorSlug={(doctor as { slug?: string | null }).slug ?? null}
          initialAppointments={(appointments as any[]) ?? []}
          workingHours={workingHours}
          initialDateKey={searchParams?.date ?? null}
          openManualBooking={searchParams?.manual === "1"}
        />
      </div>
    </main>
  );
}
