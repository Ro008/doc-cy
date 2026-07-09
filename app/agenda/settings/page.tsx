// app/agenda/settings/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type {
  DoctorServiceItem,
  DoctorSettingsFormData,
} from "@/components/dashboard/SettingsForm";
import { PromotePracticeSection } from "@/components/dashboard/PromotePracticeSection";
import { FoundingMemberBadge } from "@/components/dashboard/FoundingMemberBadge";
import { OnlineBookingsPauseToggle } from "@/components/dashboard/OnlineBookingsPauseToggle";
import { GesyPatientsToggle } from "@/components/dashboard/GesyPatientsToggle";
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
  const supabase = createServerComponentClient({ cookies });
  const localeLike = "en";

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
    avatar_url?: string | null;
    phone?: string | null;
    slug?: string | null;
    specialty?: string | null;
    languages?: string[] | null;
    district?: string | null;
    clinic_address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    clinic_place_id?: string | null;
    status?: string | null;
    is_specialty_approved?: boolean | null;
    specialty_requires_standard_at?: string | null;
    subscription_tier?: string | null;
    is_gesy?: boolean | null;
  } | null = null;
  let doctorError: unknown = null;
  const hasColError = (err: unknown, col: string): boolean =>
    String((err as { message?: string } | null)?.message ?? "")
      .toLowerCase()
      .includes(col.toLowerCase());
  try {
    let res = await supabase
      .from("doctors")
      .select(
        "id, name, avatar_url, phone, slug, specialty, languages, district, clinic_address, latitude, longitude, clinic_place_id, status, subscription_tier, is_gesy"
      )
      .eq("auth_user_id", user.id)
      .single();

    if (
      res.error &&
      (hasColError(res.error, "latitude") ||
        hasColError(res.error, "longitude") ||
        hasColError(res.error, "clinic_place_id"))
    ) {
      res = await supabase
        .from("doctors")
        .select(
          "id, name, avatar_url, phone, slug, specialty, languages, district, clinic_address, status, subscription_tier, is_gesy"
        )
        .eq("auth_user_id", user.id)
        .single();
    }

    if (res.error && hasColError(res.error, "is_gesy")) {
      res = await supabase
        .from("doctors")
        .select(
          "id, name, avatar_url, phone, slug, specialty, languages, district, clinic_address, status, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (res.error && hasColError(res.error, "avatar_url")) {
      res = await supabase
        .from("doctors")
        .select(
          "id, name, phone, slug, specialty, languages, district, clinic_address, status, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (res.error && hasColError(res.error, "subscription_tier")) {
      res = await supabase
        .from("doctors")
        .select(
          "id, name, avatar_url, phone, slug, specialty, languages, district, clinic_address, status"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (res.error && (res.error as { code?: string }).code === "42703") {
      res = await supabase
        .from("doctors")
        .select("id, name, phone, slug, specialty, languages, district, clinic_address, status")
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
        "id, name, avatar_url, slug, specialty, languages, district, clinic_address, status, is_specialty_approved, specialty_requires_standard_at, subscription_tier"
      )
      .eq("auth_user_id", user.id)
      .single();

    if (fallback.error && hasColError(fallback.error, "specialty_requires_standard_at")) {
      fallback = await supabase
        .from("doctors")
        .select(
          "id, name, avatar_url, slug, specialty, languages, district, clinic_address, status, is_specialty_approved, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }

    if (fallback.error && hasColError(fallback.error, "avatar_url")) {
      fallback = await supabase
        .from("doctors")
        .select(
          "id, name, slug, specialty, languages, district, clinic_address, status, is_specialty_approved, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (fallback.error && hasColError(fallback.error, "subscription_tier")) {
      fallback = await supabase
        .from("doctors")
        .select(
          "id, name, avatar_url, slug, specialty, languages, district, clinic_address, status, is_specialty_approved"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (fallback.error && (fallback.error as { code?: string }).code === "42703") {
      fallback = await supabase
        .from("doctors")
        .select("id, name, slug, specialty, languages, district, clinic_address, status, is_specialty_approved")
        .eq("auth_user_id", user.id)
        .single();
    }

    doctor = fallback.data as typeof doctor;
    doctorError = fallback.error ?? doctorError;
  }

  if (doctor) {
    // Always hydrate specialty review flags so banner/UI state remains correct
    // even when primary selects use compatibility fallbacks.
    const { data: specialtyFlags } = await supabase
      .from("doctors")
      .select("is_specialty_approved, specialty_requires_standard_at")
      .eq("id", doctor.id)
      .maybeSingle();
    if (specialtyFlags) {
      doctor = {
        ...doctor,
        is_specialty_approved:
          (specialtyFlags as { is_specialty_approved?: boolean | null })
            .is_specialty_approved ?? doctor.is_specialty_approved ?? null,
        specialty_requires_standard_at:
          (specialtyFlags as { specialty_requires_standard_at?: string | null })
            .specialty_requires_standard_at ??
          doctor.specialty_requires_standard_at ??
          null,
      };
    }
  }

  if (doctorError) {
    console.error("[Settings] Error fetching doctor for user", doctorError);
  }

  if (!doctor) {
    return (
      <main className="min-h-screen bg-ink-900 text-slate-50">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
          <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
          <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-clinical-400/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-slate-200">
            Professional profile not found for this account. Please contact support.
          </p>
          <SignOutButton />
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
    avatarUrl:
      (doctor.avatar_url ?? "").trim().length > 0
        ? supabase.storage.from("avatars").getPublicUrl(String(doctor.avatar_url)).data.publicUrl
        : null,
    specialty: (doctor.specialty ?? "").trim(),
    isSpecialtyApproved: doctor.is_specialty_approved ?? true,
    languages: langArr,
    whatsappNumber: doctor.phone ?? undefined,
    district: (doctor.district ?? "").trim(),
    clinicAddress: (doctor.clinic_address ?? "").trim(),
    clinicLatitude: doctor.latitude ?? null,
    clinicLongitude: doctor.longitude ?? null,
    clinicPlaceId: doctor.clinic_place_id ?? null,
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
    <main className="min-h-screen bg-ink-900 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-clinical-400/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-8 mt-2 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-clinical-400/90">
              Settings
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                {displayName}
              </h1>
              {isFoundingMember ? <FoundingMemberBadge /> : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:max-w-md lg:flex-nowrap lg:justify-end">
            <OnlineBookingsPauseToggle
              initialPaused={pauseOnlineBookings}
              layout="header"
            />
          </div>
        </header>

        <section className="w-full space-y-5 rounded-3xl border border-clinical-100/10 bg-slate-900/50 p-6 shadow-2xl shadow-ink-900/50 backdrop-blur-xl sm:p-8">
          <SettingsForm initial={initial} />
          <GesyPatientsToggle initialAcceptsGesy={Boolean(doctor.is_gesy)} />
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SignOutOtherSessionsButton />
          <SignOutButton data-testid="settings-sign-out-button" />
        </div>

        <div id="promote-practice" className="mt-8 scroll-mt-24">
          {isVerified ? (
            <PromotePracticeSection
              slug={doctor.slug}
              doctorName={doctor.name}
              localeLike={localeLike}
            />
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
