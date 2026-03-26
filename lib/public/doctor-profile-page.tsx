import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { supabase } from "@/lib/supabase";
import { BookingSection } from "@/components/doctor/BookingSection";
import { DoctorDetailsAccordion } from "@/components/doctor/DoctorDetailsAccordion";
import { LanguagesSpoken } from "@/components/doctor/LanguagesSpoken";
import {
  ProfileNotLive,
  type PublicProfileBlockReason,
} from "@/components/doctor/ProfileNotLive";
import { WhatToExpectCard } from "@/components/doctor/WhatToExpectCard";
import {
  settingsToWeeklySlots,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { format } from "date-fns";
import { CLINIC_ADDRESS, MAPS_URL } from "@/lib/clinic-info";
import {
  DOCTOR_FIELD_LIST_METADATA,
  DOCTOR_FIELD_LIST_PUBLIC_PROFILE,
  DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_LANG,
} from "@/lib/doctor-fieldsets";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { getTranslations } from "next-intl/server";

const DOCTOR_AVATAR_URL =
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop";

type DoctorProfileRow = {
  id: string;
  name: string;
  specialty: string;
  bio: string | null;
  clinic_address: string | null;
  slug: string;
  status: string;
  languages?: string[] | null;
};

export type PageProps = {
  params: { slug: string };
};

function isLanguagesColumnError(msg: string): boolean {
  return (
    /languages/i.test(msg) &&
    (/schema cache|does not exist|column|Could not find|42703/i.test(msg) ||
      msg.includes("Could not find"))
  );
}

function isDoctorsPublicUnavailable(msg: string, code?: string): boolean {
  return (
    code === "PGRST205" ||
    /doctors_public|schema cache|not find.*table|does not exist/i.test(msg)
  );
}

function isDoctorSettingsSchemaError(msg: string, code?: string): boolean {
  return (
    code === "42703" ||
    /doctor_settings|column|does not exist|schema cache/i.test(msg ?? "")
  );
}

type PublicDoctorFetch =
  | { kind: "ok"; profile: DoctorProfileRow }
  | { kind: "not_found" }
  | {
      kind: "not_verified";
      name: string;
      verificationStatus: PublicProfileBlockReason;
    };

/**
 * Load doctor by slug. Public UI only when verification `status` is `verified`.
 * If `languages` column is missing, fall back to a select without it.
 */
async function fetchPublicDoctorBySlug(
  slug: string,
): Promise<PublicDoctorFetch> {
  const fullList = DOCTOR_FIELD_LIST_PUBLIC_PROFILE;
  const basicList = DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_LANG;

  let first = await supabase
    .from("doctors_public")
    .select(fullList)
    .eq("slug", slug)
    .maybeSingle();

  if (first.error) {
    const msg = first.error.message ?? "";
    const code = (first.error as { code?: string }).code;
    if (isDoctorsPublicUnavailable(msg, code)) {
      first = await supabase
        .from("doctors")
        .select(fullList)
        .eq("slug", slug)
        .maybeSingle();
    }
  }

  let row: DoctorProfileRow | null = first.data as DoctorProfileRow | null;

  if (first.error) {
    const msg = first.error.message ?? "";
    if (isLanguagesColumnError(msg)) {
      const second = await supabase
        .from("doctors")
        .select(basicList)
        .eq("slug", slug)
        .maybeSingle();
      if (second.error || !second.data) {
        console.error(
          "[DocCy] Doctor profile fallback query failed:",
          second.error ?? "no row",
        );
        return { kind: "not_found" };
      }
      row = { ...second.data, languages: null } as DoctorProfileRow;
    } else {
      console.error("[DocCy] Doctor profile query failed:", first.error);
      return { kind: "not_found" };
    }
  }

  if (!row) {
    return { kind: "not_found" };
  }

  const st = (row.status ?? "").trim().toLowerCase();
  if (st === "verified") {
    return { kind: "ok", profile: row };
  }

  const verificationStatus: PublicProfileBlockReason =
    st === "rejected" ? "rejected" : "pending";
  return { kind: "not_verified", name: row.name, verificationStatus };
}

export const revalidate = 0;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const profileUrl = `${siteUrl}/${params.slug}`;
  const fallbackTitle = "Healthcare Professional | DocCy";

  let meta = await supabase
    .from("doctors_public")
    .select(DOCTOR_FIELD_LIST_METADATA)
    .eq("slug", params.slug)
    .maybeSingle();

  if (
    meta.error &&
    isDoctorsPublicUnavailable(meta.error.message ?? "", meta.error.code)
  ) {
    meta = await supabase
      .from("doctors")
      .select(DOCTOR_FIELD_LIST_METADATA)
      .eq("slug", params.slug)
      .maybeSingle();
  }

  const doctor = meta.data as {
    name?: string;
    specialty?: string;
    status?: string;
  } | null;

  if (meta.error || !doctor) {
    return {
      title: fallbackTitle,
      description: "Book healthcare appointments in Cyprus via DocCy.",
      openGraph: {
        title: fallbackTitle,
        description: "Book healthcare appointments in Cyprus via DocCy.",
        type: "website",
        url: profileUrl,
        images: [{ url: DOCTOR_AVATAR_URL }],
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: "Book healthcare appointments in Cyprus via DocCy.",
        images: [DOCTOR_AVATAR_URL],
      },
    };
  }

  const st = (doctor.status ?? "").trim().toLowerCase();
  const doctorName = (doctor.name ?? "").trim();
  const specialty = (doctor.specialty ?? "").trim();
  const hasNameAndSpecialty = doctorName.length > 0 && specialty.length > 0;

  const dynamicTitle = hasNameAndSpecialty
    ? `Book an appointment with ${doctorName} | ${specialty} | DocCy`
    : fallbackTitle;
  const dynamicDescription = hasNameAndSpecialty
    ? `Book your next ${specialty} appointment with ${doctorName} in Cyprus via DocCy.`
    : "Book healthcare appointments in Cyprus via DocCy.";

  if (st !== "verified") {
    return {
      title: dynamicTitle,
      description: dynamicDescription,
      openGraph: {
        title: dynamicTitle,
        description: dynamicDescription,
        type: "website",
        url: profileUrl,
        images: [{ url: DOCTOR_AVATAR_URL }],
      },
      twitter: {
        card: "summary_large_image",
        title: dynamicTitle,
        description: dynamicDescription,
        images: [DOCTOR_AVATAR_URL],
      },
    };
  }

  return {
    title: dynamicTitle,
    description: dynamicDescription,
    openGraph: {
      title: dynamicTitle,
      description: dynamicDescription,
      type: "website",
      url: profileUrl,
      images: [{ url: DOCTOR_AVATAR_URL }],
    },
    twitter: {
      card: "summary_large_image",
      title: dynamicTitle,
      description: dynamicDescription,
      images: [DOCTOR_AVATAR_URL],
    },
  };
}

export default async function DoctorPage({ params }: PageProps) {
  const result = await fetchPublicDoctorBySlug(params.slug);
  const t = await getTranslations("DoctorProfilePage");

  if (result.kind === "not_found") {
    console.error(
      `[DocCy] No doctor row for slug: "${params.slug}". Redirecting to home.`,
    );
    redirect("/");
  }

  if (result.kind === "not_verified") {
    return (
      <ProfileNotLive
        doctorName={result.name}
        verificationStatus={result.verificationStatus}
      />
    );
  }

  const profile = result.profile;

  const settingsSelectFull =
    "doctor_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule, break_start, break_end, slot_duration_minutes, pause_online_bookings, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours";
  const settingsSelectLegacy =
    "doctor_id, monday, tuesday, wednesday, thursday, friday, start_time, end_time, break_start, break_end, slot_duration_minutes";

  const { data: settingsFull, error: settingsErr } = await supabase
    .from("doctor_settings")
    .select(settingsSelectFull)
    .eq("doctor_id", profile.id)
    .single();

  let settings: any = settingsFull ?? null;
  if (
    settingsErr &&
    isDoctorSettingsSchemaError(
      settingsErr.message ?? "",
      (settingsErr as any)?.code,
    )
  ) {
    const { data: settingsLegacy } = await supabase
      .from("doctor_settings")
      .select(settingsSelectLegacy)
      .eq("doctor_id", profile.id)
      .single();
    settings = settingsLegacy ?? null;
  }

  const normalizedSettings: DoctorSettingsRow | null = settings
    ? ({
        ...settings,
        saturday: Boolean((settings as any).saturday ?? false),
        sunday: Boolean((settings as any).sunday ?? false),
        pause_online_bookings: Boolean(
          (settings as any).pause_online_bookings ?? false,
        ),
        holiday_mode_enabled: Boolean(
          (settings as any).holiday_mode_enabled ?? false,
        ),
        holiday_start_date: (settings as any).holiday_start_date ?? null,
        holiday_end_date: (settings as any).holiday_end_date ?? null,
        booking_horizon_days: Number(
          (settings as any).booking_horizon_days ?? 90,
        ),
        minimum_notice_hours: Number(
          (settings as any).minimum_notice_hours ?? 2,
        ),
      } as DoctorSettingsRow)
    : null;

  const weeklySlots = normalizedSettings
    ? settingsToWeeklySlots(normalizedSettings)
    : [];

  const breakStart =
    (normalizedSettings as { break_start?: string | null } | null)
      ?.break_start ?? null;
  const breakEnd =
    (normalizedSettings as { break_end?: string | null } | null)?.break_end ??
    null;

  // Busy instants only (RLS blocks direct reads on appointments for anon).
  const nowUtc = new Date();
  const fromIso = new Date(nowUtc.getTime() - 60 * 60 * 1000).toISOString();
  const toIso = new Date(
    nowUtc.getTime() + 8 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: occupiedRows, error: occupiedErr } = await supabase.rpc(
    "public_doctor_occupied_datetimes",
    {
      p_doctor_id: profile.id,
      p_from: fromIso,
      p_to: toIso,
    },
  );

  if (occupiedErr) {
    console.error(
      "[DocCy] public_doctor_occupied_datetimes failed:",
      occupiedErr,
    );
  }

  const takenSlotTimes: string[] = (occupiedRows ?? []).map(
    (r: { appointment_datetime: string }) =>
      format(
        appointmentToCyprusDate(r.appointment_datetime),
        "yyyy-MM-dd'T'HH:mm",
      ),
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Background gradient / glow (consistent with landing) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="mb-8 flex flex-col gap-4 sm:gap-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-emerald-200/80 break-words">
              Doc<span className="text-emerald-400">Cy</span> · {t("profileTag")}
            </p>
            <LanguageSwitcher compact />
          </div>
          <div className="flex gap-5">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-400/30 shadow-lg shadow-slate-950/50 sm:h-28 sm:w-28">
              <Image
                src={DOCTOR_AVATAR_URL}
                alt=""
                fill
                className="object-cover"
                sizes="112px"
                priority
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                {profile.name}
              </h1>
              <p className="mt-1.5 text-base font-medium capitalize tracking-wide text-emerald-200/95 sm:text-lg">
                {profile.specialty}
              </p>
              {Array.isArray(profile.languages) &&
              profile.languages.length > 0 ? (
                <LanguagesSpoken
                  languages={profile.languages}
                  className="mt-2.5 w-full"
                />
              ) : null}

            </div>
          </div>
        </header>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-8">
          {/* Booking first on mobile, right column on desktop */}
          <section className="order-1 lg:order-2 lg:min-w-0">
            <BookingSection
              doctorId={profile.id}
              doctorName={profile.name}
              weeklySlots={weeklySlots}
              takenSlotTimes={takenSlotTimes}
              profileSlug={params.slug}
              breakStart={breakStart ? breakStart.slice(0, 5) : undefined}
              breakEnd={breakEnd ? breakEnd.slice(0, 5) : undefined}
              onlineBookingsPaused={Boolean(
                (
                  normalizedSettings as {
                    pause_online_bookings?: boolean | null;
                  } | null
                )?.pause_online_bookings,
              )}
              holidayModeEnabled={Boolean(
                (
                  normalizedSettings as {
                    holiday_mode_enabled?: boolean | null;
                  } | null
                )?.holiday_mode_enabled,
              )}
              holidayStartDate={
                (
                  normalizedSettings as {
                    holiday_start_date?: string | null;
                  } | null
                )?.holiday_start_date ?? null
              }
              holidayEndDate={
                (
                  normalizedSettings as {
                    holiday_end_date?: string | null;
                  } | null
                )?.holiday_end_date ?? null
              }
              bookingHorizonDays={
                (
                  normalizedSettings as {
                    booking_horizon_days?: number | null;
                  } | null
                )?.booking_horizon_days ?? 90
              }
              minimumNoticeHours={
                (
                  normalizedSettings as {
                    minimum_notice_hours?: number | null;
                  } | null
                )?.minimum_notice_hours ?? 2
              }
            />
          </section>

          {/* What to expect: outside About accordion so it stays visible on mobile */}
          <div className="order-2 flex flex-col gap-4 lg:order-1">
            <WhatToExpectCard />
            <DoctorDetailsAccordion
              name={profile.name}
              bio={profile.bio}
              clinicAddress={CLINIC_ADDRESS}
              mapsUrl={MAPS_URL}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

