import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { supabase } from "@/lib/supabase";
import { BookingSection } from "@/components/doctor/BookingSection";
import { DoctorDetailsAccordion } from "@/components/doctor/DoctorDetailsAccordion";
import { LanguagesSpoken } from "@/components/doctor/LanguagesSpoken";
import {
  ProfileNotLive,
  type PublicProfileBlockReason,
} from "@/components/doctor/ProfileNotLive";
import { WhatToExpectCard } from "@/components/doctor/WhatToExpectCard";
import { ServiceMenuSection } from "@/components/doctor/ServiceMenuSection";
import { DoctorLocationSection } from "@/components/doctor/DoctorLocationSection";
import {
  settingsToWeeklySlots,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";
import { appointmentToCyprusDate, CY_TZ } from "@/lib/appointments";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { CLINIC_ADDRESS, buildMapsUrlFromAddress } from "@/lib/clinic-info";
import {
  DOCTOR_FIELD_LIST_PUBLIC_PROFILE_BASE,
  DOCTOR_FIELD_LIST_METADATA,
  DOCTOR_FIELD_LIST_METADATA_NO_DISTRICT,
  DOCTOR_FIELD_LIST_PUBLIC_PROFILE,
  DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_LANG,
} from "@/lib/doctor-fieldsets";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { getTranslations } from "next-intl/server";
import {
  normalizeDistrictForSeoTitle,
  withDoctorTitleHonorific,
} from "@/lib/doctor-seo-formatting";

const DOCTOR_AVATAR_URL =
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop";

type DoctorProfileRow = {
  id: string;
  name: string;
  specialty: string;
  bio: string | null;
  clinic_address: string | null;
  district?: string | null;
  slug: string;
  status: string;
  languages?: string[] | null;
};

export type PageProps = {
  params: { slug: string };
};

function isOptionalProfileColumnError(msg: string): boolean {
  return (
    /(languages|district)/i.test(msg) &&
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
  const baseList = DOCTOR_FIELD_LIST_PUBLIC_PROFILE_BASE;

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
    if (isOptionalProfileColumnError(msg)) {
      const second = await supabase
        .from("doctors")
        .select(basicList)
        .eq("slug", slug)
        .maybeSingle();
      if (second.error && isOptionalProfileColumnError(second.error.message ?? "")) {
        const third = await supabase
          .from("doctors")
          .select(baseList)
          .eq("slug", slug)
          .maybeSingle();
        if (third.error || !third.data) {
          console.error(
            "[DocCy] Doctor profile fallback query failed:",
            third.error ?? "no row",
          );
          return { kind: "not_found" };
        }
        row = { ...third.data, languages: null, district: null } as DoctorProfileRow;
      } else if (second.error || !second.data) {
        console.error(
          "[DocCy] Doctor profile fallback query failed:",
          second.error ?? "no row",
        );
        return { kind: "not_found" };
      } else {
        row = { ...second.data, languages: null } as DoctorProfileRow;
      }
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

type PhysicianStructuredData = {
  "@context": "https://schema.org";
  "@type": "Physician";
  name: string;
  url?: string;
  sameAs?: string;
  areaServed: "Cyprus";
  address: {
    "@type": "PostalAddress";
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    addressCountry: "CY";
  };
  image?: string;
  medicalSpecialty?: string;
  telephone?: string;
  knowsLanguage?: string[];
  description?: string;
};

function parseAddressParts(address: string): { streetAddress?: string; addressLocality?: string } {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { streetAddress: parts[0] };
  return {
    streetAddress: parts[0],
    addressLocality: parts.slice(1).join(", "),
  };
}

function buildPhysicianStructuredData(input: {
  name: string;
  specialty?: string | null;
  bio?: string | null;
  clinicAddress?: string | null;
  district?: string | null;
  phone?: string | null;
  languages?: string[] | null;
  imageUrl?: string | null;
  profileUrl?: string | null;
  sameAs?: string | null;
}): PhysicianStructuredData {
  const name = input.name.trim();
  const specialty = (input.specialty ?? "").trim();
  const bio = (input.bio ?? "").trim();
  const district = (input.district ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const languages = Array.isArray(input.languages)
    ? input.languages.map((l) => String(l).trim()).filter(Boolean)
    : [];
  const addressRaw = (input.clinicAddress ?? "").trim();
  const addressParts = parseAddressParts(addressRaw);

  const address: PhysicianStructuredData["address"] = {
    "@type": "PostalAddress",
    addressCountry: "CY",
    ...(addressParts.streetAddress ? { streetAddress: addressParts.streetAddress } : {}),
    ...(addressParts.addressLocality
      ? { addressLocality: addressParts.addressLocality }
      : district
        ? { addressLocality: district }
        : {}),
    ...(district ? { addressRegion: district } : {}),
  };

  const description =
    bio ||
    (specialty
      ? `${name} provides ${specialty} services in Cyprus via DocCy.`
      : `${name} provides healthcare services in Cyprus via DocCy.`);

  const profileUrl = String(input.profileUrl ?? "").trim();
  const sameAs = String(input.sameAs ?? "").trim();

  return {
    "@context": "https://schema.org",
    "@type": "Physician",
    name,
    ...(profileUrl ? { url: profileUrl } : {}),
    ...(sameAs ? { sameAs } : {}),
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    ...(specialty ? { medicalSpecialty: specialty } : {}),
    address,
    ...(phone ? { telephone: phone } : {}),
    ...(languages.length > 0 ? { knowsLanguage: languages } : {}),
    areaServed: "Cyprus",
    ...(description ? { description } : {}),
  };
}

function buildVerifiedRegisteredMetaTitle(input: {
  doctorName: string;
  specialty: string;
  districtLabel: string | null;
}): string | null {
  const name = input.doctorName.trim();
  if (!name) return null;
  const titled = withDoctorTitleHonorific(name);
  const spec = input.specialty.trim();
  const city = input.districtLabel?.trim() || "Cyprus";
  if (spec.length > 0) {
    return `Book Online with ${titled} | ${spec} in ${city} | DocCy`;
  }
  return `Book Online with ${titled} in ${city} | DocCy`;
}

/** Pending / rejected slug pages: informative, no instant-booking promise. */
function buildNonLiveDoctorMetaTitle(input: {
  doctorName: string;
  specialty: string;
  districtLabel: string | null;
}): string | null {
  const name = input.doctorName.trim();
  if (!name) return null;
  const titled = withDoctorTitleHonorific(name);
  const spec = input.specialty.trim();
  const city = input.districtLabel?.trim() || "Cyprus";
  if (spec.length > 0) {
    return `${titled} | ${spec} in ${city} | Profile & Contact | DocCy`;
  }
  return `${titled} in ${city} | Profile & Contact | DocCy`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const profileUrl = `${siteUrl}/${params.slug}`;
  const fallbackTitle = "Healthcare Professional | DocCy";

  const loadMeta = async (fields: typeof DOCTOR_FIELD_LIST_METADATA | typeof DOCTOR_FIELD_LIST_METADATA_NO_DISTRICT) => {
    let m = await supabase
      .from("doctors_public")
      .select(fields)
      .eq("slug", params.slug)
      .maybeSingle();

    if (
      m.error &&
      isDoctorsPublicUnavailable(m.error.message ?? "", m.error.code)
    ) {
      m = await supabase.from("doctors").select(fields).eq("slug", params.slug).maybeSingle();
    }
    return m;
  };

  let meta = await loadMeta(DOCTOR_FIELD_LIST_METADATA);
  if (meta.error && isOptionalProfileColumnError(meta.error.message ?? "")) {
    meta = await loadMeta(DOCTOR_FIELD_LIST_METADATA_NO_DISTRICT);
  }

  const doctor = meta.data as {
    name?: string;
    specialty?: string;
    status?: string;
    district?: string | null;
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
  const districtLabel = normalizeDistrictForSeoTitle(doctor.district);
  const cityLabel = districtLabel ?? "Cyprus";
  const metaTitleCore =
    st === "verified"
      ? buildVerifiedRegisteredMetaTitle({ doctorName, specialty, districtLabel })
      : buildNonLiveDoctorMetaTitle({ doctorName, specialty, districtLabel });
  const dynamicTitle = metaTitleCore ?? fallbackTitle;
  const dynamicDescription =
    st === "verified" && specialty.length > 0
      ? `Book your next ${specialty} appointment online with ${withDoctorTitleHonorific(doctorName)} in ${cityLabel}. Secure scheduling via DocCy.`
      : st === "verified"
        ? `Book online with ${withDoctorTitleHonorific(doctorName)} in ${cityLabel} via DocCy.`
        : specialty.length > 0
          ? `View profile and contact details for ${withDoctorTitleHonorific(doctorName)} (${specialty} in ${cityLabel}) on DocCy.`
          : `View profile and contact details for ${withDoctorTitleHonorific(doctorName)} in ${cityLabel} on DocCy.`;

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
  const authSupabase = createServerComponentClient({ cookies });

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
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  let isOwnerView = false;
  if (user?.id) {
    const { data: ownerDoctor } = await authSupabase
      .from("doctors")
      .select("auth_user_id")
      .eq("id", profile.id)
      .maybeSingle();
    isOwnerView = ownerDoctor?.auth_user_id === user.id;
  }
  const clinicAddress = (profile.clinic_address ?? "").trim() || CLINIC_ADDRESS;
  const mapsUrl = buildMapsUrlFromAddress(clinicAddress);
  let avatarUrl = DOCTOR_AVATAR_URL;
  let hasCustomAvatar = false;
  let publicPhone: string | null = null;
  const avatarLookup = await supabase
    .from("doctors")
    .select("avatar_url, phone")
    .eq("id", profile.id)
    .maybeSingle();
  if (avatarLookup.error) {
    const avatarOnlyLookup = await supabase
      .from("doctors")
      .select("avatar_url")
      .eq("id", profile.id)
      .maybeSingle();
    const avatarPath = String(
      (avatarOnlyLookup.data as { avatar_url?: string | null } | null)?.avatar_url ??
        "",
    ).trim();
    if (avatarPath) {
      avatarUrl = supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl;
      hasCustomAvatar = true;
    }
  } else {
    const avatarPath = String(
      (avatarLookup.data as { avatar_url?: string | null; phone?: string | null } | null)
        ?.avatar_url ?? "",
    ).trim();
    publicPhone = String(
      (avatarLookup.data as { phone?: string | null } | null)?.phone ?? "",
    ).trim() || null;
    if (avatarPath) {
      avatarUrl = supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl;
      hasCustomAvatar = true;
    }
  }

  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mydoccy.com")
    .trim()
    .replace(/\/+$/, "");
  const profileCanonicalUrl = `${siteBase}/${params.slug}`;

  const structuredData = buildPhysicianStructuredData({
    name: profile.name,
    specialty: profile.specialty,
    bio: profile.bio,
    clinicAddress: clinicAddress,
    district: profile.district ?? null,
    phone: publicPhone,
    languages: profile.languages ?? null,
    imageUrl: hasCustomAvatar ? avatarUrl : null,
    profileUrl: profileCanonicalUrl,
    sameAs: mapsUrl || null,
  });

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
  const fromIso = new Date(nowUtc.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const horizonRaw = normalizedSettings?.booking_horizon_days ?? 90;
  const maxHorizonDays = [14, 30, 90, 180].includes(horizonRaw)
    ? horizonRaw
    : 90;
  const todayCyprus = utcToZonedTime(nowUtc, CY_TZ);
  const lastBookableDay = addDays(todayCyprus, maxHorizonDays);
  // End of the day after last bookable date (Cyprus): covers late slots + long visit durations vs POST /api/appointments.
  const occupiedRangeEndCyprus = addDays(lastBookableDay, 1);
  const toIso = zonedTimeToUtc(
    `${format(occupiedRangeEndCyprus, "yyyy-MM-dd")}T23:59:59.999`,
    CY_TZ,
  ).toISOString();

  // Slot starts covered by visits (forward + backward vs slot_duration_minutes); must match POST /api/appointments.
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

  const { data: serviceRows, error: servicesErr } = await supabase
    .from("doctor_services")
    .select("id, name, price")
    .eq("doctor_id", profile.id)
    .order("created_at", { ascending: true });
  if (servicesErr) {
    console.error("[DocCy] doctor_services fetch failed:", servicesErr);
  }
  const services = (serviceRows ?? [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim(),
      price: row.price ? String(row.price).trim() : null,
    }))
    .filter((row) => row.name.length > 0);

  const profileDistrictLabel = normalizeDistrictForSeoTitle(profile.district);
  const profileHeadingCity =
    profileDistrictLabel ?? t("profileHeadingCityFallback");

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Background gradient / glow (consistent with landing) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {isOwnerView ? (
          <div className="mb-6 rounded-2xl border border-emerald-300/35 bg-emerald-400/12 px-4 py-3 text-sm text-emerald-100">
            You are viewing your public profile.{" "}
            <a href="/agenda/settings" className="font-semibold underline underline-offset-2">
              Edit Profile
            </a>{" "}
          </div>
        ) : null}
        <header className="mb-8 flex flex-col gap-4 sm:gap-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 break-words">
              <a
                href="/finder"
                className="inline-flex transition hover:opacity-90"
              >
                <DocCyWordmark />
              </a>
              <span className="text-xs font-semibold tracking-[0.16em] text-emerald-200/80">
                · {t("profileTag")}
              </span>
            </div>
            <LanguageSwitcher compact />
          </div>
          <div className="flex items-start gap-5">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-400/30 shadow-lg shadow-slate-950/50 sm:h-28 sm:w-28">
              <Image
                src={avatarUrl}
                alt=""
                fill
                className="object-cover"
                sizes="112px"
                priority
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-balance leading-tight">
                <span className="block text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                  {profile.name}
                </span>
                <span className="mt-1.5 block text-base font-medium capitalize tracking-wide text-emerald-200/95 sm:text-lg">
                  {profile.specialty}
                </span>
                <span className="mt-1 block text-base font-medium tracking-wide text-slate-300 sm:text-lg">
                  {profileHeadingCity}
                </span>
              </h1>
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
            />
            <DoctorLocationSection clinicAddress={clinicAddress} mapsUrl={mapsUrl} />
            <ServiceMenuSection services={services} />
          </div>
        </div>
      </div>
    </main>
  );
}

