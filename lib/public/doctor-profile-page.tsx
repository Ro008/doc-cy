import Image from "next/image";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { createServiceRoleClient } from "@/lib/supabase-service";
import { BookingSection } from "@/components/doctor/BookingSection";
import { WhatToExpectCard } from "@/components/doctor/WhatToExpectCard";
import { ProfileAboutSection } from "@/components/doctor/profile/ProfileAboutSection";
import { ProfileClinicsSection } from "@/components/doctor/profile/ProfileClinicsSection";
import { ProfileNextAvailability } from "@/components/doctor/profile/ProfileNextAvailability";
import { ProfileSchemeToggle } from "@/components/doctor/profile/ProfileSchemeToggle";
import { ProfileScrollFade } from "@/components/doctor/profile/ProfileScrollFade";
import { ProfileBreadcrumbs } from "@/components/doctor/profile/ProfileBreadcrumbs";
import { ProfileMobileBookBar } from "@/components/doctor/profile/ProfileMobileBookBar";
import { ProfileReportLink } from "@/components/doctor/profile/ProfileReportLink";
import { ProfileShareButton } from "@/components/doctor/profile/ProfileShareButton";
import { ProfileSectionNav } from "@/components/doctor/profile/ProfileSectionNav";
import { ProfileServicesSection } from "@/components/doctor/profile/ProfileServicesSection";
import { languageThemeForLabel } from "@/lib/cyprus-languages";
import { profileCustomizationFromRow } from "@/lib/profile-customization";
import { profileThemeStyle } from "@/lib/profile-theme";
import { PROFILE_SCHEME_COOKIE, parseProfileScheme } from "@/lib/profile-scheme";
import { computePublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";
import { buildProfileClinicCards } from "@/lib/public/profile-clinic-cards";
import { summarizeNextAvailabilityDays } from "@/lib/public/profile-next-availability";
import { profileDistricts } from "@/lib/public/profile-districts";
import { profileBreadcrumbs } from "@/lib/public/profile-breadcrumbs";
import { buildProfileStructuredData } from "@/lib/public/profile-structured-data";
import {
  clinicOpeningHours,
  formatOpeningDays,
  formatOpeningRanges,
} from "@/lib/public/clinic-opening-hours";
import { PROFILE_SECTION_IDS, profileSectionTabs } from "@/lib/public/profile-sections";
import { DoctorProfileClinicPicker } from "@/components/doctor/DoctorProfileClinicPicker";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";
import { primaryClinicLocationFields } from "@/lib/professional-clinic-locations";
import {
  ACCOUNT_SETTINGS_FALLBACK,
  clinicTitleOrFallback,
  locationToSettingsRow,
} from "@/lib/doctor-locations";
import { parseBookingLocationParam, parseBookingSlotParam } from "@/lib/booking-slot-param";
import { loadProfessionalAccountSettings } from "@/lib/professional-account-settings";
import {
  OCCUPIED_BATCH_RPC,
  takenSlotTimesFor,
  type OccupiedRow,
} from "@/lib/public/load-doctor-next-available-slot";
import {
  buildWeeklyScheduleFromSettings,
  settingsToWeeklySlots,
  type DayKey,
} from "@/lib/doctor-settings";
import { appointmentToCyprusDate, CY_TZ } from "@/lib/appointments";
import { addDays, format } from "date-fns";
import { el as elLocale, enGB } from "date-fns/locale";
import { Building2, MapPin } from "lucide-react";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";
import {
  DOCTOR_FIELD_LIST_PUBLIC_PROFILE_BASE,
  DOCTOR_FIELD_LIST_METADATA,
  DOCTOR_FIELD_LIST_PUBLIC_PROFILE,
  DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_GESY,
  DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_LANG,
} from "@/lib/doctor-fieldsets";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { RecordRecentlyViewed } from "@/components/finder/RecordRecentlyViewed";
import { FinderPublicHeader } from "@/components/finder/FinderPublicHeader";
import { isProSessionHintValue, PRO_SESSION_HINT_COOKIE } from "@/lib/pro-session-hint";
import { ManualDirectoryProfessionalLanding } from "@/components/finder/ManualDirectoryProfessionalLanding";
import {
  FinderDistrictLink,
} from "@/components/finder/FinderSpecialtyLink";
import { DoctorProfileSpecialties } from "@/components/doctor/DoctorProfileSpecialties";
import { getTranslations } from "next-intl/server";
import {
  buildRegisteredProfileMetaDescription,
  buildRegisteredProfileMetaTitle,
  buildShareImageMetadata,
  formatProfessionalSeoDisplayName,
  normalizeDistrictForSeoTitle,
  resolveShareAvatarUrl,
} from "@/lib/doctor-seo-formatting";
import { getPublicSpecialtyDisplayLabel } from "@/lib/doctor-specialty-public";
import {
  formatSpecialtiesForSeo,
  publicSpecialtyLabels,
} from "@/lib/doctor-specialties";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  specialtyNames,
  primarySpecialtyEntry,
  SPECIALTY_ROWS_SELECT,
  specialtyEntriesFromRows,
} from "@/lib/specialty-catalogue";
import { loadFinderRegisteredClinics } from "@/lib/public/load-finder-registered-clinics";
import { clinicForRenderedLocation } from "@/lib/public/finder-card-clinic-match";
import {
  resolveAbsorbedProfessionalSlugRedirect,
  resolveManualDirectoryProfileForSlug,
} from "@/lib/load-manual-directory-by-slug";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import {
  buildManualDirectorySeoDescription,
  buildManualDirectorySeoTitle,
} from "@/lib/manual-directory-seo";

/** Public profile SSR reads — service_role only (anon has no SELECT on professionals). */
function getPublicDirectoryDb(): SupabaseClient | null {
  return createServiceRoleClient();
}

type DoctorProfileRow = {
  id: string;
  name: string;
  specialty: string;
  specialties?: string[] | null;
  bio: string | null;
  clinic_address: string | null;
  district?: string | null;
  slug: string;
  languages?: string[] | null;
  is_gesy?: boolean | null;
};

export type PageProps = {
  params: { slug: string; locale?: string };
  searchParams?: { slot?: string | string[]; location?: string | string[] };
};

function profileLocale(params: PageProps["params"]): string {
  return String(params.locale ?? "").trim() || "en";
}

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com").replace(
    /\/+$/,
    "",
  );
}

async function loadUnregisteredLandingOrRedirect(slug: string, locale: string) {
  const supabase = getPublicDirectoryDb();
  if (!supabase) return null;

  const absorbed = await resolveAbsorbedProfessionalSlugRedirect(supabase, slug);
  if (absorbed) {
    permanentRedirect(publicProfessionalProfilePath(absorbed, locale));
  }

  const { row, redirectSlug } = await resolveManualDirectoryProfileForSlug(supabase, slug);
  if (redirectSlug && redirectSlug.toLowerCase() !== slug.toLowerCase()) {
    permanentRedirect(publicProfessionalProfilePath(redirectSlug, locale));
  }

  return row;
}

function isOptionalProfileColumnError(msg: string): boolean {
  return (
    /(languages|district|is_gesy|specialties)/i.test(msg) &&
    (/schema cache|does not exist|column|Could not find|42703/i.test(msg) ||
      msg.includes("Could not find"))
  );
}

function isPublicProfileSourceUnavailable(msg: string, code?: string): boolean {
  // Missing optional columns (e.g. district before migration) must fall through to
  // isOptionalProfileColumnError — not be treated as a missing table.
  if (code === "42703" || isOptionalProfileColumnError(msg)) return false;
  return (
    code === "PGRST205" ||
    /professionals|schema cache|not find.*table|does not exist/i.test(msg)
  );
}

/**
 * Read a public profile straight from `professionals`.
 *
 * Replaces the dropped `doctors_public` view: the two filters below are the view's
 * WHERE clause, and the callers pass the view's safe column lists from
 * lib/doctor-fieldsets. Service role only — anon was never granted either.
 */
async function selectPublicProfessionalBySlug(
  supabase: SupabaseClient,
  fields: string,
  slug: string,
): Promise<{
  data: Record<string, unknown> | null;
  error: { message?: string; code?: string } | null;
}> {
  // `fields` is a runtime-chosen column list, so PostgREST cannot infer a row type
  // here; the shape is narrowed by the caller's cast, as it was through the view.
  const res = await supabase
    .from("professionals")
    .select(`${fields}, ${SPECIALTY_ROWS_SELECT}`)
    .eq("is_registered", true)
    .eq("is_archived", false)
    .eq("slug", slug)
    .maybeSingle();
  const data = (res.data as unknown as Record<string, unknown> | null) ?? null;
  if (data) {
    // Specialty fields are derived from professional_specialties (the columns on
    // professionals are going away): labels alphabetical, the first one as `specialty`.
    const { specialty_rows: rows, ...rest } = data;
    const entries = specialtyEntriesFromRows(rows);
    // Where they practise comes from their clinics, not the copies on professionals
    // (Point E): a professional created by the registration approval has none.
    const location = primaryClinicLocationFields(
      await loadDoctorLocations(String(rest.id ?? "")),
    );
    return {
      data: {
        ...rest,
        district: location.district,
        clinic_address: location.clinic_address,
        specialties: specialtyNames(entries),
        specialty: primarySpecialtyEntry(entries)?.name ?? "",
      },
      error: null,
    };
  }
  return {
    data: null,
    error: (res.error as { message?: string; code?: string } | null) ?? null,
  };
}

type PublicDoctorFetch =
  | { kind: "ok"; profile: DoctorProfileRow }
  | { kind: "not_found" };

/**
 * Load a registered professional by slug (an approved registration is live).
 * If `languages` column is missing, fall back to a select without it.
 */
async function fetchPublicDoctorBySlug(
  slug: string,
): Promise<PublicDoctorFetch> {
  const supabase = getPublicDirectoryDb();
  if (!supabase) {
    console.error("[DocCy] service role client unavailable for public doctor profile");
    return { kind: "not_found" };
  }

  const fullList = DOCTOR_FIELD_LIST_PUBLIC_PROFILE;
  const basicList = DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_LANG;
  const baseList = DOCTOR_FIELD_LIST_PUBLIC_PROFILE_BASE;

  let first = await selectPublicProfessionalBySlug(supabase, fullList, slug);

  if (first.error) {
    const msg = first.error.message ?? "";
    const code = (first.error as { code?: string }).code;
    if (isPublicProfileSourceUnavailable(msg, code)) {
      console.error("[DocCy] professionals read unavailable:", first.error);
      return { kind: "not_found" };
    }
  }

  let row: DoctorProfileRow | null = first.data as DoctorProfileRow | null;

  if (first.error) {
    const msg = first.error.message ?? "";
    if (/is_gesy/i.test(msg)) {
      const noGesy = await selectPublicProfessionalBySlug(
        supabase,
        DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_GESY,
        slug,
      );
      if (!noGesy.error && noGesy.data) {
        row = { ...noGesy.data, is_gesy: false } as DoctorProfileRow;
      }
    }
    if (!row && isOptionalProfileColumnError(msg)) {
      const second = await selectPublicProfessionalBySlug(supabase, basicList, slug);
      if (second.error && isOptionalProfileColumnError(second.error.message ?? "")) {
        const third = await selectPublicProfessionalBySlug(supabase, baseList, slug);
        if (third.error || !third.data) {
          console.error(
            "[DocCy] Doctor profile fallback query failed:",
            third.error ?? "no row",
          );
          return { kind: "not_found" };
        }
        row = {
          ...third.data,
          languages: null,
          is_gesy: false,
        } as DoctorProfileRow;
      } else if (second.error || !second.data) {
        console.error(
          "[DocCy] Doctor profile fallback query failed:",
          second.error ?? "no row",
        );
        return { kind: "not_found" };
      } else {
        row = { ...second.data, languages: null, is_gesy: false } as DoctorProfileRow;
      }
    } else {
      console.error("[DocCy] Doctor profile query failed:", first.error);
      return { kind: "not_found" };
    }
  }

  if (!row) {
    return { kind: "not_found" };
  }

  const profile: DoctorProfileRow = {
    ...row,
    specialty: getPublicSpecialtyDisplayLabel({ specialty: row.specialty }),
  };
  return { kind: "ok", profile };
}

export const revalidate = 0;

function resolvePublicAvatarUrl(
  supabase: SupabaseClient,
  avatarPathOrUrl: string | null | undefined,
): string | null {
  return resolveShareAvatarUrl(avatarPathOrUrl, (path) =>
    supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl,
  );
}

/** "Dr. Eleni Georgiou" → "Eleni" for "About Eleni". */
function profileFirstName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words.find((word) => !/^(dr|prof|mr|mrs|ms|mx)\.?$/i.test(word));
  return first ?? words[0] ?? name;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const locale = profileLocale(params);
  const supabase = getPublicDirectoryDb();
  if (supabase) {
    const absorbed = await resolveAbsorbedProfessionalSlugRedirect(supabase, params.slug);
    if (absorbed) {
      permanentRedirect(publicProfessionalProfilePath(absorbed, locale));
    }
  }
  const profileUrl = `${siteBaseUrl()}${publicProfessionalProfilePath(params.slug, locale)}`;
  const fallbackTitle = "Healthcare Professional | DocCy";

  const loadMeta = async (fields: typeof DOCTOR_FIELD_LIST_METADATA) => {
    const supabase = getPublicDirectoryDb();
    if (!supabase) {
      return {
        data: null,
        error: { message: "service role unavailable", code: "DOC_CY_NO_SERVICE_ROLE" },
      };
    }
    const m = await selectPublicProfessionalBySlug(supabase, fields, params.slug);

    if (
      m.error &&
      isPublicProfileSourceUnavailable(m.error.message ?? "", m.error.code)
    ) {
      return m;
    }
    return m;
  };

  const meta = await loadMeta(DOCTOR_FIELD_LIST_METADATA);

  const doctor = meta.data as {
    name?: string;
    specialty?: string;
    district?: string | null;
    avatar_url?: string | null;
  } | null;

  if (meta.error || !doctor) {
    const unregistered = await loadUnregisteredLandingOrRedirect(params.slug, locale);
    if (unregistered) {
      const pageUrl = `${siteBaseUrl()}${publicProfessionalProfilePath(unregistered.slug, locale)}`;
      const title = buildManualDirectorySeoTitle({
        name: unregistered.displayName,
        specialty: unregistered.specialty,
        district: unregistered.district,
      });
      const description = buildManualDirectorySeoDescription({
        name: unregistered.displayName,
        specialty: unregistered.specialty,
        district: unregistered.district,
      });
      return {
        title,
        description,
        alternates: { canonical: pageUrl },
        openGraph: {
          title,
          description,
          type: "website",
          url: pageUrl,
          ...(unregistered.photoUrl ? { images: [{ url: unregistered.photoUrl }] } : {}),
        },
        twitter: {
          card: unregistered.photoUrl ? "summary_large_image" : "summary",
          title,
          description,
          ...(unregistered.photoUrl ? { images: [unregistered.photoUrl] } : {}),
        },
      };
    }

    return {
      title: fallbackTitle,
      description: "Book healthcare appointments in Cyprus via DocCy.",
      robots: { index: false, follow: false },
      openGraph: {
        title: fallbackTitle,
        description: "Book healthcare appointments in Cyprus via DocCy.",
        type: "website",
        url: profileUrl,
      },
      twitter: {
        card: "summary",
        title: fallbackTitle,
        description: "Book healthcare appointments in Cyprus via DocCy.",
      },
    };
  }

  const doctorName = formatProfessionalSeoDisplayName(doctor.name ?? "");
  const specialtyLabels = publicSpecialtyLabels({
    specialties: (doctor as { specialties?: string[] | null }).specialties,
    specialty: doctor.specialty,
  });
  const specialty = getPublicSpecialtyDisplayLabel({
    specialty: doctor.specialty,
    fallback: "",
  });
  const specialtyForSeo =
    formatSpecialtiesForSeo(specialtyLabels) || (doctor.specialty ?? "").trim();
  const districtLabel = normalizeDistrictForSeoTitle(doctor.district);
  const cityLabel = districtLabel ?? "Cyprus";
  const metaTitleCore = buildRegisteredProfileMetaTitle({
    doctorName,
    specialty: specialtyForSeo || specialty,
    districtLabel,
  });
  const dynamicTitle = metaTitleCore ?? fallbackTitle;
  // The root layout's canonical is "/": without this every profile claimed to be the
  // home page. English is the canonical copy (the Greek one is not reviewed yet).
  const canonicalUrl = `${siteBaseUrl()}${publicProfessionalProfilePath(params.slug)}`;
  const dynamicDescription = buildRegisteredProfileMetaDescription({
    doctorName,
    specialtyForSeo,
    cityLabel,
  });

  const shareImageUrl = supabase
    ? resolvePublicAvatarUrl(supabase, doctor.avatar_url)
    : null;
  const shareImages = buildShareImageMetadata(shareImageUrl);

  return {
    title: dynamicTitle,
    description: dynamicDescription,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: dynamicTitle,
      description: dynamicDescription,
      type: "website",
      url: profileUrl,
      ...(shareImages.openGraphImages
        ? { images: shareImages.openGraphImages }
        : {}),
    },
    twitter: {
      card: shareImages.twitterCard,
      title: dynamicTitle,
      description: dynamicDescription,
      ...(shareImages.twitterImages ? { images: shareImages.twitterImages } : {}),
    },
  };
}

export default async function DoctorPage({ params, searchParams }: PageProps) {
  const result = await fetchPublicDoctorBySlug(params.slug);
  const t = await getTranslations("DoctorProfilePage");
  const bookingT = await getTranslations("BookingPage");
  const authSupabase = createServerComponentClient({ cookies });
  const proSessionHint = isProSessionHintValue(
    cookies().get(PRO_SESSION_HINT_COOKIE)?.value,
  );

  if (result.kind === "not_found") {
    const locale = profileLocale(params);
    const unregistered = await loadUnregisteredLandingOrRedirect(params.slug, locale);
    if (unregistered) {
      return (
        <ManualDirectoryProfessionalLanding
          row={unregistered}
          locale={locale}
          proSessionHint={proSessionHint}
        />
      );
    }
    notFound();
  }

  const profile = result.profile;
  const supabase = getPublicDirectoryDb();
  if (!supabase) {
    console.error("[DocCy] service role client unavailable for public doctor profile data");
    redirect("/");
  }

  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  let isOwnerView = false;
  if (user?.id) {
    const { data: ownerDoctor } = await authSupabase
      .from("professionals")
      .select("auth_user_id")
      .eq("id", profile.id)
      .maybeSingle();
    isOwnerView = ownerDoctor?.auth_user_id === user.id;
  }
  const clinicAddress = stripPlusCodePrefix((profile.clinic_address ?? "").trim());
  let avatarUrl: string | null = null;
  const contactLookup = await supabase
    .from("professionals")
    .select("avatar_url")
    .eq("is_registered", true)
    .eq("is_archived", false)
    .eq("id", profile.id)
    .maybeSingle();
  if (!contactLookup.error && contactLookup.data) {
    const contact = contactLookup.data as { avatar_url?: string | null };
    const avatarPath = String(contact.avatar_url ?? "").trim();
    if (avatarPath) {
      avatarUrl = resolvePublicAvatarUrl(supabase, avatarPath);
    }
  } else if (contactLookup.error) {
    console.error("[DocCy] public contact lookup failed:", contactLookup.error);
  }

  const profileCanonicalUrl = `${siteBaseUrl()}${publicProfessionalProfilePath(params.slug)}`;

  // Account settings (holiday, horizon, notice); the schedule is the clinic link's (Point E6).
  const { settings: normalizedSettings } = await loadProfessionalAccountSettings(
    supabase,
    profile.id,
  );

  const [practiceLocations, registeredClinics] = await Promise.all([
    loadDoctorLocations(profile.id),
    loadFinderRegisteredClinics(profile.id),
  ]);
  // Every public phone is the clinic's (user, 2026-09-29): one Call per clinic that has
  // a phone, whether or not it takes online bookings.
  const linkedClinics = registeredClinics.byProfessionalId.get(profile.id) ?? [];
  const clinicForLocation = (location: { id: string; clinic_address?: string | null }) =>
    clinicForRenderedLocation({
      locationId: location.id,
      locationAddress: location.clinic_address,
      byLocationId: registeredClinics.byLocationId,
      candidates: linkedClinics,
    });
  const callClinics = linkedClinics.filter((clinic) => clinic.id && clinic.hasPhone);
  const requestedLocationId = parseBookingLocationParam(
    Array.isArray(searchParams?.location)
      ? searchParams?.location[0]
      : searchParams?.location,
  );
  const selectedLocation =
    (requestedLocationId
      ? practiceLocations.find((row) => row.id === requestedLocationId)
      : null) ??
    (practiceLocations.length === 1 ? practiceLocations[0] : null) ??
    primaryDoctorLocation(practiceLocations);

  const locationSettings = selectedLocation
    ? locationToSettingsRow(
        selectedLocation,
        normalizedSettings ?? ACCOUNT_SETTINGS_FALLBACK,
      )
    : null;

  const weeklySlots = locationSettings
    ? settingsToWeeklySlots(locationSettings)
    : [];

  const breakStart =
    (locationSettings as { break_start?: string | null } | null)
      ?.break_start ?? null;
  const breakEnd =
    (locationSettings as { break_end?: string | null } | null)?.break_end ??
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
    OCCUPIED_BATCH_RPC,
    {
      p_professional_ids: [profile.id],
      p_from: fromIso,
      p_to: toIso,
    },
  );

  if (occupiedErr) {
    console.error(`[DocCy] ${OCCUPIED_BATCH_RPC} failed:`, occupiedErr);
  }

  const takenSlotTimes: string[] = takenSlotTimesFor(
    (occupiedRows ?? []) as OccupiedRow[],
    { professionalId: profile.id, locationId: selectedLocation?.id ?? null, toIso },
  );

  const { data: serviceRows, error: servicesErr } = await supabase
    .from("professional_services")
    .select("id, name, price")
    .eq("professional_id", profile.id)
    .order("created_at", { ascending: true });
  if (servicesErr) {
    console.error("[DocCy] professional_services fetch failed:", servicesErr);
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
  const profileSpecialtyLabels = publicSpecialtyLabels({
    specialties: profile.specialties,
    specialty: profile.specialty,
  });
  const profileSpecialtySeo = formatSpecialtiesForSeo(profileSpecialtyLabels);
  // The booking panel's "call instead" hint is about the clinic being booked.
  const selectedClinic = selectedLocation ? clinicForLocation(selectedLocation) : null;
  const hasPublicPhone = selectedClinic
    ? Boolean(selectedClinic.hasPhone)
    : callClinics.length > 0;

  // ─── One-page layout (hero, sticky anchor tabs, sections) ───────────────────
  const customization = profileCustomizationFromRow(profile);
  // Light unless this visitor switched to dark (cookie, so no flash on load).
  const scheme = parseProfileScheme(cookies().get(PROFILE_SCHEME_COOKIE)?.value);
  const accountSettings = normalizedSettings as {
    holiday_mode_enabled?: boolean | null;
    holiday_start_date?: string | null;
    holiday_end_date?: string | null;
    booking_horizon_days?: number | null;
    minimum_notice_hours?: number | null;
  } | null;
  // No clinic, no schedule: nothing to book online.
  const onlineBookingsPaused =
    !locationSettings || Boolean(locationSettings.pause_online_bookings);
  const holidayModeEnabled = Boolean(accountSettings?.holiday_mode_enabled);
  const holidayStartDate = accountSettings?.holiday_start_date ?? null;
  const holidayEndDate = accountSettings?.holiday_end_date ?? null;
  const bookingHorizonDays = accountSettings?.booking_horizon_days ?? 90;
  const minimumNoticeHours = accountSettings?.minimum_notice_hours ?? 2;
  const breakStartHm = breakStart ? breakStart.slice(0, 5) : undefined;
  const breakEndHm = breakEnd ? breakEnd.slice(0, 5) : undefined;

  // Same slot rules as BookingSection, for the hero's next-availability days.
  const nextDays = onlineBookingsPaused
    ? []
    : summarizeNextAvailabilityDays(
        computePublicAvailabilityCalendar({
          weeklySlots,
          takenSlotTimes,
          breakStart: breakStartHm,
          breakEnd: breakEndHm,
          holidayModeEnabled,
          holidayStartDate,
          holidayEndDate,
          bookingHorizonDays,
          minimumNoticeHours,
        }).days,
      );
  const locale = profileLocale(params);
  const dayLabelLocale = locale === "el" ? elLocale : enGB;
  const dayByDate: Record<string, string> = {};
  const fromByDate: Record<string, string> = {};
  for (const day of nextDays) {
    const [y, m, d] = day.dateKey.split("-").map(Number);
    dayByDate[day.dateKey] = format(new Date(y, m - 1, d), "EEE d MMM", { locale: dayLabelLocale });
    fromByDate[day.dateKey] = t("nextAvailabilityFrom", { time: day.fromTime });
  }

  const selectedLocationTitle =
    practiceLocations.length > 1 && selectedLocation
      ? clinicTitleOrFallback(
          selectedLocation.label,
          bookingT("clinicNumber", {
            number:
              Math.max(
                0,
                practiceLocations.findIndex((row) => row.id === selectedLocation.id),
              ) + 1,
          }),
        )
      : null;

  const clinicCards = buildProfileClinicCards({
    locations: practiceLocations,
    clinicForLocation,
    phoneClinics: callClinics,
    selectedLocationId: selectedLocation?.id ?? null,
    fallbackTitle: (number) => bookingT("clinicNumber", { number }),
    missingAddress: bookingT("clinicAddressMissing"),
    fallbackAddress: clinicAddress,
  });
  const hasClinicPhone = clinicCards.some((card) => card.phoneClinicId);

  const sectionTabs = profileSectionTabs({
    hasServices: services.length > 0,
    hasClinics: clinicCards.length > 0,
  }).map((tab) => ({ id: tab.id, label: t(tab.labelKey) }));

  // Every district with a clinic (Nicosia · Paphos), not only the primary one.
  const districts = profileDistricts({ locations: practiceLocations, fallback: profile.district });
  // Same colour chips as the finder cards (lib/cyprus-languages).
  const languageChips = (Array.isArray(profile.languages) ? profile.languages : [])
    .map((raw) => String(raw).trim())
    .filter(Boolean)
    .map((raw) => languageThemeForLabel(raw));
  // Opening hours per clinic card, from the same schedule as the bookable times.
  const weekdayLabel = (day: DayKey) =>
    format(
      new Date(2026, 0, { monday: 5, tuesday: 6, wednesday: 7, thursday: 8, friday: 9, saturday: 10, sunday: 11 }[day]),
      "EEE",
      { locale: dayLabelLocale },
    );
  const openingHoursByLocation = new Map(
    practiceLocations.map((location) => {
      const row = locationToSettingsRow(location, normalizedSettings ?? ACCOUNT_SETTINGS_FALLBACK);
      return [
        location.id,
        clinicOpeningHours(buildWeeklyScheduleFromSettings(row), {
          breakStart: row.break_start,
          breakEnd: row.break_end,
        }),
      ] as const;
    }),
  );
  const openingHoursByCard: Record<string, Array<{ days: string; hours: string }>> = {};
  for (const [locationId, groups] of openingHoursByLocation) {
    openingHoursByCard[locationId] = groups.map((group) => ({
      days: formatOpeningDays(group.days, weekdayLabel),
      hours: formatOpeningRanges(group.ranges),
    }));
  }

  const breadcrumbs = profileBreadcrumbs({
    specialty: profileSpecialtyLabels[0] ?? profile.specialty,
    district: districts[0] ?? profileDistrictLabel,
    name: profile.name,
  });

  const structuredData = buildProfileStructuredData({
    name: profile.name,
    profileUrl: profileCanonicalUrl,
    siteUrl: siteBaseUrl(),
    specialty: profileSpecialtySeo || profile.specialty || null,
    description:
      (profile.bio ?? "").trim() ||
      `${profile.name} provides ${profileSpecialtySeo || profile.specialty || "healthcare"} services in Cyprus via DocCy.`,
    imageUrl: avatarUrl,
    languages: languageChips.map((chip) => chip.label),
    services: services.map((service) => ({ name: service.name, price: service.price })),
    clinics: practiceLocations.map((location, index) => ({
      name: clinicTitleOrFallback(location.label, bookingT("clinicNumber", { number: index + 1 })),
      address: stripPlusCodePrefix(String(location.clinic_address ?? "")),
      district: normalizeDistrictForSeoTitle(location.district),
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
      openingHours: openingHoursByLocation.get(location.id) ?? [],
    })),
    breadcrumbs,
  });

  const firstDay = nextDays[0];
  const mobileBarNext = firstDay
    ? t("mobileBarNext", {
        when: `${firstDay.isToday ? t("nextAvailabilityToday") : dayByDate[firstDay.dateKey]} · ${firstDay.fromTime}`,
      })
    : null;

  // Links in the hero look like links (underline); plain facts do not.
  const heroLinkClass =
    "underline decoration-2 underline-offset-4 transition hover:decoration-[3px] focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent-on";

  return (
    <main
      className="doccy-profile min-h-screen font-sans"
      data-scheme={scheme}
      style={profileThemeStyle(customization.accent)}
    >
      <div className="border-b border-profile-border bg-profile-surface">
        <FinderPublicHeader proSessionHint={proSessionHint} />
      </div>
      {!isOwnerView ? (
        <RecordRecentlyViewed
          item={{
            kind: "professional",
            href: publicProfessionalProfilePath(params.slug, profileLocale(params)),
            name: profile.name,
            subtitle: profileSpecialtySeo || profile.specialty,
            location: profileHeadingCity,
            photoUrl: avatarUrl,
          }}
        />
      ) : null}
      {/* One script per object (Physician, BreadcrumbList), the form every reader expects. */}
      {structuredData.map((item) => (
        <script
          key={String(item["@type"])}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      <div className="mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6 lg:px-8">
        {isOwnerView ? (
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-profile-border bg-accent-soft px-4 py-3 text-sm text-profile-text">
            <span>{t("ownerBanner")}</span>
            <a href="/agenda/settings" className="font-bold underline underline-offset-2">
              {t("ownerEditProfile")}
            </a>
            <a href="/agenda/settings#public-page" className="font-bold underline underline-offset-2">
              {t("ownerCustomize")}
            </a>
          </div>
        ) : null}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <ProfileBreadcrumbs crumbs={breadcrumbs} ariaLabel={t("breadcrumbLabel")} />
          <div className="flex items-center gap-2">
            <ProfileShareButton
              url={profileCanonicalUrl}
              title={profile.name}
              labels={{ share: t("shareLabel"), copied: t("shareCopied") }}
            />
            {/* No language switcher until the Greek copy is reviewed (user, 2026-10-02). */}
            <ProfileSchemeToggle
              initial={scheme}
              labels={{
                group: t("schemeGroupLabel"),
                light: t("schemeLight"),
                dark: t("schemeDark"),
              }}
            />
          </div>
        </div>

        <header className="grid gap-6 rounded-[2rem] bg-accent p-5 text-accent-on sm:p-7 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:gap-8">
          <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-4 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-x-6">
            <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-3xl bg-accent-avatar sm:row-span-2 sm:h-44 sm:w-36 sm:rounded-[1.75rem]">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 96px, 144px"
                  priority
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-4xl font-extrabold sm:text-5xl"
                  aria-hidden
                >
                  {getInitials(profile.name)}
                </div>
              )}
            </div>
            <h1 className="min-w-0 text-balance text-3xl font-extrabold leading-[1.05] tracking-tight sm:self-end sm:text-[44px]">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{profile.name}</span>
                  {profile.is_gesy ? (
                    <GesyProviderBadge size="xs" language="el" className="shrink-0" />
                  ) : null}
                </span>
            </h1>
            <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:self-start">
              <DoctorProfileSpecialties
                specialties={profileSpecialtyLabels}
                specialty={profile.specialty}
                district={profileDistrictLabel}
                pillClassName="inline-flex max-w-full items-center rounded-full bg-accent-on px-3 py-1.5 text-left text-sm font-bold text-accent transition hover:opacity-90"
              />
              {customization.headline ? (
                <p className="mt-3 max-w-xl text-lg font-semibold leading-snug">
                  {customization.headline}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] font-bold">
                <span className="inline-flex flex-wrap items-center gap-x-1.5">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {districts.length > 0 ? (
                    districts.map((district, index) => (
                      <span key={district} className="inline-flex items-center gap-x-1.5">
                        {index > 0 ? <span aria-hidden>·</span> : null}
                        <FinderDistrictLink
                          district={district}
                          className={`text-accent-on ${heroLinkClass} [&_span]:underline [&_span]:decoration-2 [&_span]:underline-offset-4`}
                        />
                      </span>
                    ))
                  ) : (
                    <span>{profileHeadingCity}</span>
                  )}
                </span>
                {clinicCards.length > 0 ? (
                  <a
                    href={`#${PROFILE_SECTION_IDS.clinics}`}
                    data-testid="profile-hero-clinics-link"
                    className={`inline-flex items-center gap-1.5 ${heroLinkClass}`}
                  >
                    <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                    {practiceLocations.length > 1
                      ? t("heroClinicsCount", { count: practiceLocations.length })
                      : t("heroClinicDetails")}
                  </a>
                ) : null}
              </div>
              {languageChips.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-extrabold uppercase tracking-[0.14em]">
                    {t("speaksLabel")}
                  </span>
                  {languageChips.map((chip) => (
                    <span
                      key={chip.label}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${chip.pillClass}`}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <ProfileNextAvailability
            days={nextDays}
            clinicLabel={selectedLocationTitle}
            canCallClinic={hasClinicPhone}
            labels={{
              title: t("nextAvailabilityTitle"),
              today: t("nextAvailabilityToday"),
              dayByDate,
              fromByDate,
              liveToday: t("nextAvailabilityLiveToday"),
              cta: t("requestAppointmentCta"),
              none: t("nextAvailabilityNone"),
              noneHint: t("nextAvailabilityNoneHint"),
            }}
          />
        </header>
      </div>

      {/* Direct child of <main> so it stays stuck for the whole page (a permanent index). */}
      <ProfileSectionNav ariaLabel={t("sectionNavLabel")} tabs={sectionTabs} />

      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section
          id={PROFILE_SECTION_IDS.book}
          aria-label={t("sectionTabBook")}
          className="grid scroll-mt-20 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6"
        >
          <div className="min-w-0">
            {practiceLocations.length > 1 ? (
              <DoctorProfileClinicPicker
                slug={params.slug}
                selectedId={selectedLocation?.id ?? null}
                clinics={practiceLocations.map((row) => ({
                  id: row.id,
                  label: row.label,
                  district: row.district,
                  clinic_address: row.clinic_address,
                  town: row.town,
                  pause_online_bookings: Boolean(row.pause_online_bookings),
                }))}
              />
            ) : null}
            <BookingSection
              doctorId={profile.id}
              doctorName={profile.name}
              weeklySlots={weeklySlots}
              takenSlotTimes={takenSlotTimes}
              profileSlug={params.slug}
              locationId={selectedLocation?.id ?? null}
              locationLabel={selectedLocationTitle}
              locationScopedPause={practiceLocations.length > 1}
              initialSlotKey={
                parseBookingSlotParam(
                  Array.isArray(searchParams?.slot)
                    ? searchParams?.slot[0]
                    : searchParams?.slot,
                )
              }
              breakStart={breakStartHm}
              breakEnd={breakEndHm}
              publicPhoneAvailable={hasPublicPhone}
              onlineBookingsPaused={onlineBookingsPaused}
              holidayModeEnabled={holidayModeEnabled}
              holidayStartDate={holidayStartDate}
              holidayEndDate={holidayEndDate}
              bookingHorizonDays={bookingHorizonDays}
              minimumNoticeHours={minimumNoticeHours}
            />
          </div>
          <WhatToExpectCard />
        </section>

        <ProfileAboutSection firstName={profileFirstName(profile.name)} bio={profile.bio} />
        <ProfileServicesSection services={services} />
        <ProfileClinicsSection
          cards={clinicCards}
          professionalId={profile.id}
          openingHours={openingHoursByCard}
        />

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-profile-border pt-6 text-sm text-profile-muted">
          <a
            href="/for-professionals"
            className="font-semibold text-accent-link underline-offset-2 hover:underline"
          >
            {t("aboutDocCy")}
          </a>
          <ProfileReportLink
            label={t("reportIncorrect")}
            message={t("reportMessage", { name: profile.name, url: profileCanonicalUrl })}
          />
        </footer>
      </div>
      <ProfileMobileBookBar next={mobileBarNext} cta={t("requestAppointmentCta")} />
      <ProfileScrollFade />
    </main>
  );
}
