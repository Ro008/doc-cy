// app/settings/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
import { SETTINGS_CARD_CLASS } from "@/components/dashboard/settings/styles";
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
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import { isFounderSubscriptionTier } from "@/lib/subscription-tier";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";
import { locationWeeklySchedule } from "@/lib/doctor-locations";
import { loadSettingsClinicPhones } from "@/lib/settings-clinic-phones";
import { FirstLoginTrialNoticeGate } from "@/components/dashboard/FirstLoginTrialNoticeGate";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  approvedSpecialtyNames,
  hasPendingSpecialty,
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
    status?: string | null;
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
      .from("professionals")
      .select(
        "id, name, avatar_url, mobile_number, slug, bio, languages, status, subscription_tier, is_gesy"
      )
      .eq("auth_user_id", user.id)
      .single();

    if (res.error && hasColError(res.error, "mobile_number")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, bio, languages, status, subscription_tier, is_gesy"
        )
        .eq("auth_user_id", user.id)
        .single();
    }

    if (res.error && hasColError(res.error, "town")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, bio, languages, status, subscription_tier, is_gesy"
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
          "id, name, avatar_url, slug, languages, status, subscription_tier, is_gesy"
        )
        .eq("auth_user_id", user.id)
        .single();
    }

    if (res.error && hasColError(res.error, "is_gesy")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, languages, status, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (res.error && hasColError(res.error, "avatar_url")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, slug, languages, status, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (res.error && hasColError(res.error, "subscription_tier")) {
      res = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, languages, status"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (res.error && (res.error as { code?: string }).code === "42703") {
      res = await supabase
        .from("professionals")
        .select("id, name, slug, languages, status")
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
        "id, name, avatar_url, slug, languages, status, specialty_requires_standard_at, subscription_tier"
      )
      .eq("auth_user_id", user.id)
      .single();

    if (fallback.error && hasColError(fallback.error, "specialty_requires_standard_at")) {
      fallback = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, languages, status, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }

    if (fallback.error && hasColError(fallback.error, "avatar_url")) {
      fallback = await supabase
        .from("professionals")
        .select(
          "id, name, slug, languages, status, subscription_tier"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (fallback.error && hasColError(fallback.error, "subscription_tier")) {
      fallback = await supabase
        .from("professionals")
        .select(
          "id, name, avatar_url, slug, languages, status"
        )
        .eq("auth_user_id", user.id)
        .single();
    }
    if (fallback.error && (fallback.error as { code?: string }).code === "42703") {
      fallback = await supabase
        .from("professionals")
        .select("id, name, slug, languages, status")
        .eq("auth_user_id", user.id)
        .single();
    }

    doctor = fallback.data as typeof doctor;
    doctorError = fallback.error ?? doctorError;
  }

  if (doctor) {
    // Always hydrate the specialty review flag so banner/UI state remains correct
    // even when primary selects use compatibility fallbacks.
    const { data: specialtyFlags } = await supabase
      .from("professionals")
      .select("specialty_requires_standard_at")
      .eq("id", doctor.id)
      .maybeSingle();
    if (specialtyFlags) {
      doctor = {
        ...doctor,
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
    .select("*")
    .eq("professional_id", doctor.id)
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

  const pauseOnlineBookings = Boolean(
    (settings as { pause_online_bookings?: boolean } | null)?.pause_online_bookings
  );

  const locationRows = await loadDoctorLocations(doctor.id);
  const primaryClinic = primaryDoctorLocation(locationRows);
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

  let pendingSpecialtyChange: DoctorSettingsFormData["pendingSpecialtyChange"] = null;
  {
    const pendingChangeRes = await supabase
      .from("professional_specialty_change_requests")
      .select("request_kind, from_specialty, to_specialty, license_number, created_at")
      .eq("professional_id", doctor.id)
      .eq("status", "pending")
      .maybeSingle();
    if (
      pendingChangeRes.error &&
      /request_kind/i.test(String(pendingChangeRes.error.message ?? ""))
    ) {
      const legacy = await supabase
        .from("professional_specialty_change_requests")
        .select("from_specialty, to_specialty, license_number, created_at")
        .eq("professional_id", doctor.id)
        .eq("status", "pending")
        .maybeSingle();
      if (!legacy.error && legacy.data) {
        const from = String(
          (legacy.data as { from_specialty?: string | null }).from_specialty ?? "",
        ).trim();
        pendingSpecialtyChange = {
          requestKind: from ? "replace" : "add",
          fromSpecialty: from || null,
          toSpecialty: String(
            (legacy.data as { to_specialty?: string }).to_specialty ?? "",
          ).trim(),
          licenseNumber: String(
            (legacy.data as { license_number?: string }).license_number ?? "",
          ).trim(),
          createdAt: String(
            (legacy.data as { created_at?: string }).created_at ?? "",
          ),
        };
      }
    } else if (!pendingChangeRes.error && pendingChangeRes.data) {
      const kindRaw = String(
        (pendingChangeRes.data as { request_kind?: string }).request_kind ?? "add",
      ).trim();
      const from = String(
        (pendingChangeRes.data as { from_specialty?: string | null }).from_specialty ??
          "",
      ).trim();
      const to = String(
        (pendingChangeRes.data as { to_specialty?: string | null }).to_specialty ?? "",
      ).trim();
      const license = String(
        (pendingChangeRes.data as { license_number?: string | null }).license_number ??
          "",
      ).trim();
      const requestKind =
        kindRaw === "replace" || kindRaw === "remove"
          ? kindRaw
          : from && !to
            ? "remove"
            : "add";
      pendingSpecialtyChange = {
        requestKind,
        fromSpecialty: from || null,
        toSpecialty: to || null,
        licenseNumber: license || null,
        createdAt: String(
          (pendingChangeRes.data as { created_at?: string }).created_at ?? "",
        ),
      };
    }
  }

  const initial: DoctorSettingsFormData = {
    specialtyOptions,
    doctorId: doctor.id,
    doctorName: doctor.name,
    avatarUrl:
      (doctor.avatar_url ?? "").trim().length > 0
        ? supabase.storage.from("avatars").getPublicUrl(String(doctor.avatar_url)).data.publicUrl
        : null,
    specialty: primarySpecialtyEntry(specialtyEntries)?.name ?? "",
    specialties: approvedSpecialtyNames(specialtyEntries),
    isSpecialtyApproved: !hasPendingSpecialty(specialtyEntries),
    pendingSpecialtyChange,
    bio: (doctor.bio ?? "").trim(),
    languages: langArr,
    mobileNumber: (doctor.mobile_number ?? "").trim() || undefined,
    // Shown read-only: patients see these, and clinics are admin-curated.
    clinicPhones: await loadSettingsClinicPhones(doctor.id),
    // The primary clinic, not the copies on professionals (Point E).
    district: (primaryClinic?.district ?? "").trim(),
    clinicAddress: (primaryClinic?.clinic_address ?? "").trim(),
    clinicTown: (primaryClinic?.town ?? "").trim() || null,
    clinicLatitude: primaryClinic?.latitude ?? null,
    clinicLongitude: primaryClinic?.longitude ?? null,
    clinicPlaceId: primaryClinic?.clinic_place_id ?? null,
    monday: (settings as { monday?: boolean } | null)?.monday ?? true,
    tuesday: (settings as { tuesday?: boolean } | null)?.tuesday ?? true,
    wednesday: (settings as { wednesday?: boolean } | null)?.wednesday ?? true,
    thursday: (settings as { thursday?: boolean } | null)?.thursday ?? true,
    friday: (settings as { friday?: boolean } | null)?.friday ?? true,
    saturday: (settings as { saturday?: boolean } | null)?.saturday ?? false,
    sunday: (settings as { sunday?: boolean } | null)?.sunday ?? false,
    weeklySchedule: buildWeeklyScheduleFromSettings({
      professional_id: doctor.id,
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
      show_phone_public: Boolean(
        (settings as { show_phone_public?: boolean | null } | null)?.show_phone_public
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
    pauseOnlineBookings,
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
                  <FoundingMemberBadge />
                </div>
              ) : null}
            </div>
          }
          profileExtra={<GesyPatientsToggle initialAcceptsGesy={Boolean(doctor.is_gesy)} />}
          account={<AccountSecurityCard email={user.email ?? ""} />}
          promote={
            <div id="promote-practice">
              {isVerified ? (
                <PromotePracticeSection
                  slug={doctor.slug}
                  doctorName={doctor.name}
                  specialty={
                    primarySpecialtyEntry(specialtyEntries)?.isApproved
                      ? primarySpecialtyEntry(specialtyEntries)?.name
                      : ""
                  }
                  localeLike={localeLike}
                />
              ) : (
                <section className={SETTINGS_CARD_CLASS}>
                  <h2 className="text-sm font-semibold text-slate-100">Available once you&apos;re verified</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    QR codes, printable signs, and downloads are available after your profile is{" "}
                    <span className="font-medium text-amber-200/90">verified</span> by our team.
                    You can still use your agenda and settings in the meantime.
                  </p>
                </section>
              )}
            </div>
          }
        />
      </div>
    </main>
  );
}
