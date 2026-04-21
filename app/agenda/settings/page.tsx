// app/agenda/settings/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { ArrowLeft } from "lucide-react";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type {
  DoctorServiceItem,
  DoctorSettingsFormData,
} from "@/components/dashboard/SettingsForm";
import { ViewPublicProfileLink } from "@/components/agenda/ViewPublicProfileLink";
import { PromotePracticeSection } from "@/components/dashboard/PromotePracticeSection";
import { FoundingMemberBadge } from "@/components/dashboard/FoundingMemberBadge";
import { OnlineBookingsPauseToggle } from "@/components/dashboard/OnlineBookingsPauseToggle";
import { DashboardUtilityRow } from "@/components/agenda/DashboardUtilityRow";
import { SignOutOtherSessionsButton } from "@/components/auth/SignOutOtherSessionsButton";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import {
  canonicalLanguageLabel,
  isMasterLanguageLabel,
} from "@/lib/cyprus-languages";
import {
  buildWeeklyScheduleFromSettings,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_MIN_NOTICE_HOURS,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import { isFounderSubscriptionTier } from "@/lib/subscription-tier";

export default async function AgendaSettingsPage() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies });
  const localeLike = cookieStore.get("NEXT_LOCALE")?.value ?? "en";

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Fetch doctor row for this authenticated user.
  // If the `phone` column isn't available in the DB yet (or query fails),
  // fall back to a basic select so the rest of the settings page still works.
  let doctor: {
    id: string;
    name: string;
    phone?: string | null;
    slug?: string | null;
    specialty?: string | null;
    languages?: string[] | null;
    status?: string | null;
    is_specialty_approved?: boolean | null;
    subscription_tier?: string | null;
  } | null = null;
  let doctorError: unknown = null;
  try {
    let res = await supabase
      .from("doctors")
      .select(
        "id, name, phone, slug, specialty, languages, status, subscription_tier"
      )
      .eq("auth_user_id", user.id)
      .single();

    const tierMissing =
      res.error &&
      (String(res.error.message ?? "")
        .toLowerCase()
        .includes("subscription_tier") ||
        (res.error as { code?: string }).code === "42703");

    if (tierMissing) {
      res = await supabase
        .from("doctors")
        .select("id, name, phone, slug, specialty, languages, status")
        .eq("auth_user_id", user.id)
        .single();
    }

    doctor = res.data as typeof doctor;
    doctorError = res.error;
  } catch (err) {
    doctorError = err;
  }

  if (!doctor) {
    let fallback = await supabase
      .from("doctors")
      .select(
        "id, name, slug, specialty, languages, status, is_specialty_approved, subscription_tier"
      )
      .eq("auth_user_id", user.id)
      .single();

    const tierMissingFb =
      fallback.error &&
      (String(fallback.error.message ?? "")
        .toLowerCase()
        .includes("subscription_tier") ||
        (fallback.error as { code?: string }).code === "42703");

    if (tierMissingFb) {
      fallback = await supabase
        .from("doctors")
        .select("id, name, slug, specialty, languages, status, is_specialty_approved")
        .eq("auth_user_id", user.id)
        .single();
    }

    doctor = fallback.data as typeof doctor;
    doctorError = fallback.error ?? doctorError;
  }

  if (doctorError) {
    console.error("[Settings] Error fetching doctor for user", doctorError);
  }

  if (!doctor) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
          <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-slate-200">
            Professional profile not found for this account. Please contact support.
          </p>
          <SignOutButton />
          <Link
            href="/agenda"
            className="mt-4 inline-flex items-center text-sm text-emerald-300 hover:text-emerald-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to agenda
          </Link>
        </div>
      </main>
    );
  }

  const { data: settings } = await supabase
    .from("doctor_settings")
    .select("*")
    .eq("doctor_id", doctor.id)
    .single();

  const { data: serviceRows } = await supabase
    .from("doctor_services")
    .select("id, name, price, created_at")
    .eq("doctor_id", doctor.id)
    .order("created_at", { ascending: true });

  const services: DoctorServiceItem[] = (serviceRows ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    price: row.price ? String(row.price) : null,
    created_at: String(row.created_at ?? ""),
  }));

  const langArr = Array.from(
    new Set(
      (Array.isArray(doctor.languages) ? doctor.languages : [])
        .map((s) => canonicalLanguageLabel(String(s).trim()))
        .filter((l) => l.length > 0 && isMasterLanguageLabel(l))
    )
  );

  const isVerified = doctor.status === "verified";
  const isFoundingMember = isFounderSubscriptionTier(doctor.subscription_tier);

  const pauseOnlineBookings = Boolean(
    (settings as { pause_online_bookings?: boolean } | null)?.pause_online_bookings
  );

  const displayName = doctorDashboardDisplayName(doctor.name);

  const initial: DoctorSettingsFormData = {
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: (doctor.specialty ?? "").trim(),
    isSpecialtyApproved: doctor.is_specialty_approved ?? true,
    languages: langArr,
    whatsappNumber: doctor.phone ?? undefined,
    monday: (settings as { monday?: boolean } | null)?.monday ?? true,
    tuesday: (settings as { tuesday?: boolean } | null)?.tuesday ?? true,
    wednesday: (settings as { wednesday?: boolean } | null)?.wednesday ?? true,
    thursday: (settings as { thursday?: boolean } | null)?.thursday ?? true,
    friday: (settings as { friday?: boolean } | null)?.friday ?? true,
    saturday: (settings as { saturday?: boolean } | null)?.saturday ?? false,
    sunday: (settings as { sunday?: boolean } | null)?.sunday ?? false,
    weeklySchedule: buildWeeklyScheduleFromSettings({
      doctor_id: doctor.id,
      monday: (settings as { monday?: boolean } | null)?.monday ?? true,
      tuesday: (settings as { tuesday?: boolean } | null)?.tuesday ?? true,
      wednesday: (settings as { wednesday?: boolean } | null)?.wednesday ?? true,
      thursday: (settings as { thursday?: boolean } | null)?.thursday ?? true,
      friday: (settings as { friday?: boolean } | null)?.friday ?? true,
      saturday: (settings as { saturday?: boolean } | null)?.saturday ?? false,
      sunday: (settings as { sunday?: boolean } | null)?.sunday ?? false,
      start_time:
        (settings as { start_time?: string } | null)?.start_time ?? "09:00:00",
      end_time:
        (settings as { end_time?: string } | null)?.end_time ?? "17:00:00",
      weekly_schedule:
        (settings as { weekly_schedule?: DoctorSettingsRow["weekly_schedule"] } | null)
          ?.weekly_schedule ?? null,
      break_start:
        (settings as { break_start?: string | null } | null)?.break_start ?? null,
      break_end:
        (settings as { break_end?: string | null } | null)?.break_end ?? null,
      pause_online_bookings: Boolean(
        (settings as { pause_online_bookings?: boolean } | null)
          ?.pause_online_bookings
      ),
      holiday_mode_enabled: Boolean(
        (settings as { holiday_mode_enabled?: boolean } | null)
          ?.holiday_mode_enabled
      ),
      holiday_start_date:
        (settings as { holiday_start_date?: string | null } | null)
          ?.holiday_start_date ?? null,
      holiday_end_date:
        (settings as { holiday_end_date?: string | null } | null)
          ?.holiday_end_date ?? null,
      booking_horizon_days:
        (settings as { booking_horizon_days?: number } | null)
          ?.booking_horizon_days ?? DEFAULT_BOOKING_HORIZON_DAYS,
      minimum_notice_hours:
        (settings as { minimum_notice_hours?: number } | null)
          ?.minimum_notice_hours ?? DEFAULT_MIN_NOTICE_HOURS,
      slot_duration_minutes:
        (settings as { slot_duration_minutes?: number } | null)
          ?.slot_duration_minutes ?? 30,
    }),
    breakEnabled:
      Boolean((settings as { break_start?: string | null } | null)?.break_start) &&
      Boolean((settings as { break_end?: string | null } | null)?.break_end),
    breakStart: (
      (settings as { break_start?: string | null } | null)?.break_start ?? "13:00:00"
    ).slice(0, 5),
    breakEnd: (
      (settings as { break_end?: string | null } | null)?.break_end ?? "14:00:00"
    ).slice(0, 5),
    slotDurationMinutes:
      (settings as { slot_duration_minutes?: number } | null)
        ?.slot_duration_minutes ?? 30,
    bookingHorizonDays:
      (settings as { booking_horizon_days?: number } | null)
        ?.booking_horizon_days ?? DEFAULT_BOOKING_HORIZON_DAYS,
    minimumNoticeHours:
      (settings as { minimum_notice_hours?: number } | null)
        ?.minimum_notice_hours ?? DEFAULT_MIN_NOTICE_HOURS,
    holidayModeEnabled: Boolean(
      (settings as { holiday_mode_enabled?: boolean | null } | null)
        ?.holiday_mode_enabled
    ),
    holidayStartDate:
      (settings as { holiday_start_date?: string | null } | null)
        ?.holiday_start_date ?? null,
    holidayEndDate:
      (settings as { holiday_end_date?: string | null } | null)
        ?.holiday_end_date ?? null,
    services,
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <DashboardUtilityRow
          left={
            <Link
              href="/agenda"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Back to agenda
            </Link>
          }
          right={
            <>
              <SignOutButton variant="utility" />
            </>
          }
        />

        <header className="mb-8 mt-2 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
              Settings
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                {displayName}
              </h1>
              {isFoundingMember ? <FoundingMemberBadge /> : null}
            </div>
            {doctor.is_specialty_approved === false ? (
              <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Your specialty text is pending review. You can edit it below or pick a standard
                category — we&apos;ll align it with our directory list.
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:max-w-md lg:flex-nowrap lg:justify-end">
            <OnlineBookingsPauseToggle
              initialPaused={pauseOnlineBookings}
              layout="header"
            />
            <ViewPublicProfileLink
              slug={doctor.slug}
              isVerified={isVerified}
              variant="primary"
            />
          </div>
        </header>

        <section className="w-full rounded-3xl border border-emerald-100/10 bg-slate-900/50 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-xl sm:p-8">
          <SettingsForm initial={initial} />
        </section>

        <div className="mt-6">
          <SignOutOtherSessionsButton />
        </div>

        <div className="mt-8">
          {isVerified ? (
            <>
              <p className="mb-3 text-xs text-slate-500">
                <span className="font-medium text-slate-400">Quick access:</span> use the floating{" "}
                <span className="text-emerald-300/90">QR</span> button (bottom-right, above Feedback)
                on any agenda page for the same poster and download.
              </p>
              <PromotePracticeSection
                slug={doctor.slug}
                doctorName={doctor.name}
                localeLike={localeLike}
              />
            </>
          ) : (
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
              <h2 className="text-sm font-semibold text-slate-100">Promote your practice</h2>
              <p className="mt-2 text-sm text-slate-400">
                QR codes, printable signs, and downloads are available after your profile is{" "}
                <span className="font-medium text-amber-200/90">verified</span> by our team. You can
                still use your agenda and settings in the meantime.
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
