// app/settings/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { parsePatientCancelNoticeHours } from "@/lib/patient-cancel-window";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { parseSettingsSection } from "@/lib/settings-sections";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type {
  DoctorServiceItem,
  DoctorSettingsFormData,
  DoctorWorkplaceFormData,
} from "@/components/dashboard/SettingsForm";
import { PromotePracticeSection } from "@/components/dashboard/PromotePracticeSection";
import { FoundingMemberBadge } from "@/components/dashboard/FoundingMemberBadge";
import { GesyPatientsToggle } from "@/components/dashboard/GesyPatientsToggle";
import { AccountSecurityCard } from "@/components/dashboard/settings/AccountSecurityCard";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { PlanBillingSection } from "@/components/dashboard/settings/PlanBillingSection";
import { planSummary } from "@/lib/settings-plan";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import {
  canonicalLanguageLabel,
  isMasterLanguageLabel,
} from "@/lib/cyprus-languages";
import {
  buildWeeklyScheduleFromSettings,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_MIN_NOTICE_HOURS,
} from "@/lib/doctor-settings";
import { isFounderSubscriptionTier } from "@/lib/subscription-tier";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";
import { loadProAccessEnded } from "@/lib/load-access-ended";
import {
  ACCOUNT_SETTINGS_FALLBACK,
  locationToSettingsRow,
  locationWeeklySchedule,
} from "@/lib/doctor-locations";
import { PROFESSIONAL_ACCOUNT_SETTINGS_SELECT } from "@/lib/professional-account-settings";
import { loadSettingsClinicPhones } from "@/lib/settings-clinic-phones";
import { FirstLoginTrialNoticeGate } from "@/components/dashboard/FirstLoginTrialNoticeGate";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  specialtyNames,
  loadSpecialtyCatalogueNames,
  loadSpecialtyEntries,
  primarySpecialtyEntry,
} from "@/lib/specialty-catalogue";

export default async function AgendaSettingsPage({
  searchParams,
}: {
  searchParams?: { section?: string | string[] };
}) {
  const section = parseSettingsSection(searchParams?.section);
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
  // If a column isn't available in the DB yet (or the query fails),
  // fall back to a basic select so the rest of the settings page still works.
  let doctor: {
    id: string;
    name: string;
    avatar_url?: string | null;
    mobile_number?: string | null;
    slug?: string | null;
    bio?: string | null;
    languages?: string[] | null;
    district?: string | null;
    clinic_address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    clinic_place_id?: string | null;
    town?: string | null;
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
      .from("professionals")
      .select(
        "id, name, avatar_url, mobile_number, slug, bio, languages, subscription_tier, is_gesy"
      )
      .eq("auth_user_id", user.id)
      .single();

    if (res.error && hasColError(res.error, "mobile_number")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, bio, languages, subscription_tier, is_gesy"
        )
        .eq("auth_user_id", user.id)
        .single();
    }

    if (res.error && hasColError(res.error, "town")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, bio, languages, subscription_tier, is_gesy"
        )
        .eq("auth_user_id", user.id)
        .single();
    }

    if (
      res.error &&
      (hasColError(res.error, "latitude") ||
        hasColError(res.error, "longitude") ||
        hasColError(res.error, "clinic_place_id"))
    ) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, languages, subscription_tier, is_gesy"
        )
        .eq("auth_user_id", user.id)
        .single();
    }

    if (res.error && hasColError(res.error, "is_gesy")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, languages, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (res.error && hasColError(res.error, "avatar_url")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, slug, languages, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (res.error && hasColError(res.error, "subscription_tier")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, languages"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (res.error && (res.error as { code?: string }).code === "42703") {
      res = await supabase
        .from("professionals")
        .select("id, name, slug, languages")
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
      .from("professionals")
      .select(
        "id, name, avatar_url, slug, languages, subscription_tier"
      )
      .eq("auth_user_id", user.id)
      .single();

    if (fallback.error && hasColError(fallback.error, "avatar_url")) {
      fallback = await supabase
        .from("professionals")
        .select(
          "id, name, slug, languages, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (fallback.error && hasColError(fallback.error, "subscription_tier")) {
      fallback = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, languages"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (fallback.error && (fallback.error as { code?: string }).code === "42703") {
      fallback = await supabase
        .from("professionals")
        .select("id, name, slug, languages")
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
      <main className="min-h-screen bg-ink-900 text-slate-50">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
          <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-clinical-500/5 blur-3xl" />
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
    .from("professional_settings")
    .select(`${PROFESSIONAL_ACCOUNT_SETTINGS_SELECT}, show_mobile_on_profile`)
    .eq("professional_id", doctor.id)
    .single();

  const { data: serviceRows } = await supabase
    .from("professional_services")
    .select("id, name, price, created_at")
    .eq("professional_id", doctor.id)
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

  const isFoundingMember = isFounderSubscriptionTier(doctor.subscription_tier);
  // Plan & billing: online booking is free until pro_access_until (approval + trial).
  const { data: accessRow } = await supabase
    .from("professionals")
    .select("pro_access_until")
    .eq("id", doctor.id)
    .maybeSingle();
  const plan = planSummary({
    proAccessUntil: (accessRow as { pro_access_until?: string | null } | null)?.pro_access_until ?? null,
    isFounder: isFoundingMember,
  });

  const locationRows = await loadDoctorLocations(doctor.id);
  const accessEnded = await loadProAccessEnded(supabase, doctor.id);
  const primaryClinic = primaryDoctorLocation(locationRows);
  // The single-clinic fields mirror the primary clinic (Point E6: schedules and the pause
  // live on the clinic links; professional_settings holds the account settings).
  const primaryHours = primaryClinic
    ? locationToSettingsRow(primaryClinic, ACCOUNT_SETTINGS_FALLBACK)
    : null;
  const pauseOnlineBookings = Boolean(primaryHours?.pause_online_bookings);
  const workplaceLocations: DoctorWorkplaceFormData[] = locationRows.map((row) => ({
    id: row.id,
    isPrimary: Boolean(row.is_primary),
    label: String(row.label ?? "").trim(),
    district: String(row.district ?? "").trim(),
    clinicAddress: String(row.clinic_address ?? "").trim(),
    clinicTown: String(row.town ?? "").trim() || null,
    clinicLatitude: row.latitude ?? null,
    clinicLongitude: row.longitude ?? null,
    clinicPlaceId: row.clinic_place_id ?? null,
    weeklySchedule: locationWeeklySchedule(row),
    breakEnabled: Boolean(row.break_start) && Boolean(row.break_end),
    breakStart: String(row.break_start ?? "13:00:00").slice(0, 5),
    breakEnd: String(row.break_end ?? "14:00:00").slice(0, 5),
    slotDurationMinutes: Number(row.slot_duration_minutes) > 0 ? Number(row.slot_duration_minutes) : 30,
    pauseOnlineBookings: Boolean(row.pause_online_bookings),
  }));

  const displayName = doctorDashboardDisplayName(doctor.name);

  // professional_specialties has no RLS policies for users: read it with the service role.
  const specialtyService = createServiceRoleClient();
  const [specialtyEntries, specialtyOptions] = specialtyService
    ? await Promise.all([
        loadSpecialtyEntries(specialtyService, doctor.id),
        loadSpecialtyCatalogueNames(specialtyService),
      ])
    : [[], []];

  const initial: DoctorSettingsFormData = {
    specialtyOptions,
    doctorId: doctor.id,
    doctorName: doctor.name,
    avatarUrl:
      (doctor.avatar_url ?? "").trim().length > 0
        ? supabase.storage.from("avatars").getPublicUrl(String(doctor.avatar_url)).data.publicUrl
        : null,
    specialty: primarySpecialtyEntry(specialtyEntries)?.name ?? "",
    specialties: specialtyNames(specialtyEntries),
    bio: (doctor.bio ?? "").trim(),
    languages: langArr,
    mobileNumber: (doctor.mobile_number ?? "").trim() || undefined,
    showMobileOnProfile: Boolean(
      (settings as { show_mobile_on_profile?: boolean | null } | null)?.show_mobile_on_profile,
    ),
    // On each clinic card: patients see these.
    clinicPhones: await loadSettingsClinicPhones(doctor.id),
    // The primary clinic, not the copies on professionals (Point E).
    district: (primaryClinic?.district ?? "").trim(),
    clinicAddress: (primaryClinic?.clinic_address ?? "").trim(),
    clinicTown: (primaryClinic?.town ?? "").trim() || null,
    clinicLatitude: primaryClinic?.latitude ?? null,
    clinicLongitude: primaryClinic?.longitude ?? null,
    clinicPlaceId: primaryClinic?.clinic_place_id ?? null,
    monday: primaryHours?.monday ?? true,
    tuesday: primaryHours?.tuesday ?? true,
    wednesday: primaryHours?.wednesday ?? true,
    thursday: primaryHours?.thursday ?? true,
    friday: primaryHours?.friday ?? true,
    saturday: primaryHours?.saturday ?? false,
    sunday: primaryHours?.sunday ?? false,
    weeklySchedule: buildWeeklyScheduleFromSettings(
      primaryHours ?? {
        professional_id: doctor.id,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
        start_time: "09:00:00",
        end_time: "17:00:00",
        weekly_schedule: null,
        break_start: null,
        break_end: null,
        pause_online_bookings: false,
        slot_duration_minutes: 30,
        ...ACCOUNT_SETTINGS_FALLBACK,
      },
    ),
    breakEnabled: Boolean(primaryHours?.break_start) && Boolean(primaryHours?.break_end),
    breakStart: String(primaryHours?.break_start ?? "13:00:00").slice(0, 5),
    breakEnd: String(primaryHours?.break_end ?? "14:00:00").slice(0, 5),
    slotDurationMinutes: primaryHours?.slot_duration_minutes ?? 30,
    bookingHorizonDays:
      (settings as { booking_horizon_days?: number } | null)
        ?.booking_horizon_days ?? DEFAULT_BOOKING_HORIZON_DAYS,
    minimumNoticeHours:
      (settings as { minimum_notice_hours?: number } | null)
        ?.minimum_notice_hours ?? DEFAULT_MIN_NOTICE_HOURS,
    patientCancelNoticeHours: parsePatientCancelNoticeHours(
      (settings as { patient_cancel_notice_hours?: number | null } | null)?.patient_cancel_notice_hours,
    ),
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
    pauseOnlineBookings,
    accessEnded,
    services,
    locations: workplaceLocations,
  };

  return (
    <main className="min-h-screen bg-ink-900 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-clinical-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-clinical-400/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
        <FirstLoginTrialNoticeGate />

        <SettingsForm
          initial={initial}
          plan={<PlanBillingSection plan={plan} isFounder={isFoundingMember} />}
          publicProfileHref={doctor.slug ? publicProfessionalProfilePath(doctor.slug) : null}
          section={section}
          sidebarHeader={
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-clinical-400/90">
                Settings
              </p>
              <p className="mt-1.5 text-lg font-semibold tracking-tight text-slate-50">{displayName}</p>
              {isFoundingMember ? (
                <div className="mt-2">
                  {/* No link here: Plan & billing is in the sidebar right below. */}
                  <FoundingMemberBadge href={null} />
                </div>
              ) : null}
            </div>
          }
          profileExtra={<GesyPatientsToggle initialAcceptsGesy={Boolean(doctor.is_gesy)} />}
          account={<AccountSecurityCard email={user.email ?? ""} />}
          promote={
            <div id="promote-practice">
              <PromotePracticeSection
                slug={doctor.slug}
                doctorName={doctor.name}
                specialty={primarySpecialtyEntry(specialtyEntries)?.name ?? ""}
                localeLike={localeLike}
              />
            </div>
          }
        />
      </div>
    </main>
  );
}
