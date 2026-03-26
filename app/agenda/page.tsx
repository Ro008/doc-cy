export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { utcToZonedTime } from "date-fns-tz";
import { ArrowLeft } from "lucide-react";
import { AgendaRealtime } from "@/components/agenda/AgendaRealtime";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { CY_TZ } from "@/lib/appointments";
import { ViewPublicProfileLink } from "@/components/agenda/ViewPublicProfileLink";
import { FoundingMemberBadge } from "@/components/dashboard/FoundingMemberBadge";
import { isFounderSubscriptionTier } from "@/lib/subscription-tier";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { DashboardUtilityRow } from "@/components/agenda/DashboardUtilityRow";
import { DashboardSecondaryButton } from "@/components/agenda/DashboardSecondaryButton";
import { CyprusTimeStamp } from "@/components/agenda/CyprusTimeStamp";
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

export default async function AgendaPage() {
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
            Professional profile not found for this account. Please contact support.
          </p>
          <SignOutButton />
          <Link
            href="/"
            className="text-sm text-emerald-300 hover:text-emerald-200"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, patient_phone, patient_email, appointment_datetime"
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
        "doctor_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule, break_start, break_end, pause_online_bookings, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours, slot_duration_minutes"
      )
      .eq("doctor_id", doctor.id)
      .single();

    const weeklyMissing =
      settingsRes.error &&
      (String(settingsRes.error.message ?? "").toLowerCase().includes("weekly_schedule") ||
        (settingsRes.error as { code?: string }).code === "42703");

    if (weeklyMissing) {
      settingsRes = await supabase
        .from("doctor_settings")
        .select(
          "doctor_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, break_start, break_end, pause_online_bookings, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours, slot_duration_minutes"
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
          (s as { slot_duration_minutes?: number | null }).slot_duration_minutes ?? 30,
      };
    }
  }

  const nowUtc = new Date();
  const nowCyprus = utcToZonedTime(nowUtc, CY_TZ);
  const nowLabel = format(nowCyprus, "dd/MM/yyyy, HH:mm", {
    locale: enGB,
  });

  const displayName = doctorDashboardDisplayName(doctor.name);

  const isFoundingMember = isFounderSubscriptionTier(
    (doctor as { subscription_tier?: string | null }).subscription_tier
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <DashboardUtilityRow
          left={
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Home
            </Link>
          }
          right={
            <>
              <SignOutButton variant="utility" />
              <CyprusTimeStamp label={nowLabel} variant="discreet" />
            </>
          }
        />

        <header className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
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

          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:max-w-md lg:flex-nowrap lg:justify-end">
            <DashboardSecondaryButton href="/agenda/settings">
              Working hours & settings
            </DashboardSecondaryButton>
            <ViewPublicProfileLink
              slug={doctor.slug}
              isVerified={doctor.status === "verified"}
              variant="primary"
            />
          </div>
        </header>

        <AgendaRealtime
          doctorId={doctor.id}
          initialAppointments={(appointments as any[]) ?? []}
          workingHours={workingHours}
        />
      </div>
    </main>
  );
}
