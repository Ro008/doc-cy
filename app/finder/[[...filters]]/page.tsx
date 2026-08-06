import type { Metadata } from "next";
import { Instagram } from "lucide-react";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { PendingLink } from "@/components/navigation/PendingLink";
import { CYPRUS_DISTRICTS, type CyprusDistrict, isCyprusDistrict } from "@/lib/cyprus-districts";
import { languageThemeForLabel } from "@/lib/cyprus-languages";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { FinderAudienceToggle } from "@/components/finder/FinderAudienceToggle";
import { FinderFilters } from "@/components/finder/FinderFilters";
import { FinderMissingDoctorCard } from "@/components/finder/FinderMissingDoctorCard";
import { FinderHeroSection } from "@/components/finder/FinderHeroSection";
import { FinderResultsCount } from "@/components/finder/FinderResultsCount";
import { FinderResultsTransition } from "@/components/finder/FinderResultsTransition";
import { FinderStructuredData } from "@/components/finder/FinderStructuredData";
import { FinderFaqSection } from "@/components/finder/FinderFaqSection";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderClinicLocationBlock } from "@/components/finder/FinderClinicLocationBlock";
import { FinderSpecialtyLink } from "@/components/finder/FinderSpecialtyLink";
import {
  ManualDirectoryDoctorClaimFooter,
  ManualDirectoryMonthlyRequestBadge,
  ManualDirectoryReportIncorrectInfoLink,
} from "@/components/finder/ManualDirectoryPatientActions";
import { FinderCardAvailabilityGrid } from "@/components/finder/FinderCardAvailabilityGrid";
import { FinderCardOnlineBookingPaused } from "@/components/finder/FinderCardOnlineBookingPaused";
import { FinderManualCardAvailabilityGrid } from "@/components/finder/FinderManualCardAvailabilityGrid";
import { FinderResultsAvailabilityShell } from "@/components/finder/FinderResultsAvailabilityShell";
import {
  finderRegisteredCardDetailsGridClass,
  finderRegisteredCardRowClass,
  finderRegisteredDetailsSectionClass,
  finderRegisteredIdentityColumnClass,
} from "@/components/finder/finder-availability-layout";
import {
  finderCardManualFooterClass,
} from "@/components/finder/finder-card-cta";
import {
  districtToSlug,
  isAllSlug,
  slugToDistrict,
  slugToSpecialty,
  specialtyToSlug,
  toTitleCaseWords,
} from "@/lib/finder-seo";
import { buildFinderSpecialtyOptions } from "@/lib/finder-specialty-options";
import { matchesSpecialtyFilter } from "@/lib/finder-specialty-filter";
import {
  getPublicSpecialtyDisplayLabel,
  matchesFinderSpecialtyFilter,
} from "@/lib/doctor-specialty-public";
import {
  finderManualVoteBadgeSinceIso,
} from "@/lib/finder-manual-vote-badge";
import { getFinderManualPhotoUrl } from "@/lib/finder-manual-photos";
import { resolveFinderDisplayPhotoUrl } from "@/lib/finder-default-avatars";
import { finderResultsPath, FOR_PROFESSIONALS_PATH } from "@/lib/finder-public-path";
import { manualDirectoryLandingPath } from "@/lib/manual-directory-landing-path";
import { isRegisteredDoctorHiddenFromFinder, isTestProfileLike } from "@/lib/doctor-test-profile";
import {
  loadAvailabilityCalendarsByDoctorId,
  loadOnlineBookingsPausedByDoctorId,
} from "@/lib/public/load-doctor-next-available-slot";
import type { PublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";
import { buildFinderAvailabilityDayHeaders } from "@/lib/public/compute-public-booking-slots";
import {
  computeFinderDistanceKm,
  formatDistanceAway,
  parseOptionalCoordinates,
  type Coordinates,
} from "@/lib/finder-distance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FinderPageProps = {
  params: {
    filters?: string[];
  };
  searchParams?: {
    district?: string;
    specialty?: string;
    name?: string;
    lat?: string;
    lon?: string;
  };
};

type RegisteredFinderRow = {
  id: string;
  name: string;
  displayName: string;
  specialty: string | null;
  district: string | null;
  slug: string | null;
  email: string | null;
  languages: string[];
  avatarUrl: string | null;
  isTestProfile: boolean;
  /** Address as entered at registration. */
  clinic_address: string | null;
  isGesy: boolean;
  isSpecialtyApproved: boolean;
  latitude: number | null;
  longitude: number | null;
};

type ManualFinderRow = {
  id: string;
  slug: string | null;
  name: string;
  displayName: string;
  specialty: string;
  district: CyprusDistrict;
  address_maps_link: string;
  phone: string | null;
  address: string | null;
  photoUrl: string;
  /** Unique patient requests in the badge rolling window (see finder-manual-vote-badge). */
  monthlyRequestCount: number;
  isGesy: boolean;
  latitude: number | null;
  longitude: number | null;
  clinic: { name: string; slug: string } | null;
};

type UnifiedFinderResult = {
  kind: "registered";
  row: RegisteredFinderRow;
  distanceKm: number | null;
  usedDistrictFallbackForDistance: boolean;
} | {
  kind: "manual";
  row: ManualFinderRow;
  distanceKm: number | null;
  usedDistrictFallbackForDistance: boolean;
};

const SEO_CITIES: CyprusDistrict[] = ["Nicosia", "Limassol", "Paphos", "Larnaca"];
const SEO_SPECIALTIES = [
  { label: "Dentistry", pluralLabel: "Dentists" },
  { label: "Dermatology", pluralLabel: "Dermatologists" },
  { label: "Physiotherapy", pluralLabel: "Physiotherapists" },
] as const;

function isRecoverableSelectSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const message = String(error.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("column") ||
    message.includes("schema cache")
  );
}

function normalizeSelectValue(value: string | undefined): string {
  return String(value ?? "").trim();
}

function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function getInitials(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "DR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function toPublicAvatarUrl(rawValue: unknown): string | null {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/avatars/${raw.replace(/^\/+/, "")}`;
}

function normalizeDistrictTerm(value: string): string {
  return value.toLowerCase().trim();
}

function parseUserCoordinates(searchParams: FinderPageProps["searchParams"]): Coordinates | null {
  const latRaw = String(searchParams?.lat ?? "").trim();
  const lonRaw = String(searchParams?.lon ?? "").trim();
  if (!latRaw || !lonRaw) return null;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  return parseOptionalCoordinates(lat, lon);
}

function decodeSegment(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function resolveDistrictValue(
  districtSegment: string | undefined,
  districtQueryParam: string | undefined
): string {
  const segment = normalizeSelectValue(decodeSegment(districtSegment));
  if (segment) {
    if (isAllSlug(segment)) return "";
    const bySlug = slugToDistrict(segment);
    if (bySlug) return bySlug;
    if (isCyprusDistrict(segment)) return segment;
  }

  const queryValue = normalizeSelectValue(districtQueryParam);
  if (!queryValue) return "";
  if (isAllSlug(queryValue)) return "";
  if (isCyprusDistrict(queryValue)) return queryValue;
  return slugToDistrict(queryValue) ?? "";
}

function resolveSpecialtyValue(
  specialtySegment: string | undefined,
  specialtyQueryParam: string | undefined
): string {
  const segment = normalizeSelectValue(decodeSegment(specialtySegment));
  if (segment) {
    if (isAllSlug(segment)) return "";
    return slugToSpecialty(segment);
  }
  const queryValue = normalizeSelectValue(specialtyQueryParam);
  if (!queryValue || isAllSlug(queryValue)) return "";
  return queryValue;
}

function resolveMetadataFilters(params: FinderPageProps["params"]): {
  district: string;
  specialty: string;
} {
  const district = resolveDistrictValue(params.filters?.[0], undefined);
  const specialty = resolveSpecialtyValue(params.filters?.[1], undefined);
  return { district, specialty };
}

export async function generateMetadata({ params }: FinderPageProps): Promise<Metadata> {
  const { district, specialty } = resolveMetadataFilters(params);
  const cleanDistrict = district.trim();
  const cleanSpecialty = specialty.trim();
  const districtLabel = cleanDistrict ? toTitleCaseWords(cleanDistrict) : "";
  const specialtyLabel = cleanSpecialty ? toTitleCaseWords(cleanSpecialty) : "";

  const genericTitle = "Find the Best Healthcare Professionals in Cyprus | Book Online - DocCy";
  const genericDescription =
    "Discover English-speaking healthcare professionals across Cyprus. Compare specialties, view locations, and book online with DocCy.";

  if (districtLabel && specialtyLabel) {
    return {
      title: `Best ${specialtyLabel} in ${districtLabel}, Cyprus | Book Online - DocCy`,
      description: `Find English-speaking professionals specializing in ${specialtyLabel} in ${districtLabel}. View locations and book online.`,
    };
  }

  if (districtLabel) {
    return {
      title: `Best Healthcare Professionals in ${districtLabel}, Cyprus | Book Online - DocCy`,
      description: `Find English-speaking healthcare professionals in ${districtLabel}, Cyprus. View specialties, locations, and book online.`,
    };
  }

  if (specialtyLabel) {
    return {
      title: `Best ${specialtyLabel} in Cyprus | Book Online - DocCy`,
      description: `Find English-speaking professionals specializing in ${specialtyLabel} across Cyprus. View locations and book online.`,
    };
  }

  return {
    title: genericTitle,
    description: genericDescription,
  };
}

export default async function FinderPage({ params, searchParams }: FinderPageProps) {
  const supabase = createServiceRoleClient();
  const activeDistrict = resolveDistrictValue(params.filters?.[0], searchParams?.district);
  const activeSpecialty = resolveSpecialtyValue(params.filters?.[1], searchParams?.specialty);
  const activeName = normalizeSelectValue(searchParams?.name);
  const userCoords = parseUserCoordinates(searchParams);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const districts = CYPRUS_DISTRICTS;

  let registeredRows: RegisteredFinderRow[] = [];
  let manualRows: ManualFinderRow[] = [];
  let dataWarning: string | null = null;

  if (supabase) {
    const registeredSelectAttempts = [
      "id, name, specialty, district, slug, email, languages, avatar_url, is_test_profile, clinic_address, is_gesy, is_specialty_approved, latitude, longitude",
      "id, name, specialty, district, slug, email, languages, avatar_url, is_test_profile, clinic_address, is_gesy, is_specialty_approved",
      "id, name, specialty, district, slug, email, languages, avatar_url, is_test_profile, clinic_address, latitude, longitude",
      "id, name, specialty, district, slug, email, languages, avatar_url, is_test_profile, clinic_address",
      "id, name, specialty, district, slug, email, languages, avatar_url, clinic_address, latitude, longitude",
      "id, name, specialty, district, slug, email, languages, avatar_url, clinic_address",
      "id, name, specialty, district, slug, email, languages, avatar_url, is_test_profile, latitude, longitude",
      "id, name, specialty, district, slug, email, languages, avatar_url, is_test_profile",
      "id, name, specialty, district, slug, email, languages, avatar_url",
      "id, name, specialty, district, slug, email, languages, is_test_profile, latitude, longitude",
      "id, name, specialty, district, slug, email, languages, is_test_profile",
      "id, name, specialty, district, slug, email, languages, latitude, longitude",
      "id, name, specialty, district, slug, email, languages",
      "id, name, specialty, district, slug, email, is_test_profile, latitude, longitude",
      "id, name, specialty, district, slug, email, is_test_profile",
      "id, name, specialty, district, slug, email, latitude, longitude",
      "id, name, specialty, district, slug, email",
      "id, name, specialty, slug, email, is_test_profile, latitude, longitude",
      "id, name, specialty, slug, email, is_test_profile",
      "id, name, specialty, slug, email, latitude, longitude",
      "id, name, specialty, slug, email",
      "id, name, specialty, district, slug, languages, avatar_url, is_test_profile, latitude, longitude",
      "id, name, specialty, district, slug, languages, avatar_url, is_test_profile",
      "id, name, specialty, district, slug, languages, avatar_url, latitude, longitude",
      "id, name, specialty, district, slug, languages, avatar_url",
      "id, name, specialty, district, slug, languages, is_test_profile, latitude, longitude",
      "id, name, specialty, district, slug, languages, is_test_profile",
      "id, name, specialty, district, slug, languages, latitude, longitude",
      "id, name, specialty, district, slug, languages",
      "id, name, specialty, district, slug, is_test_profile, latitude, longitude",
      "id, name, specialty, district, slug, is_test_profile",
      "id, name, specialty, district, slug, latitude, longitude",
      "id, name, specialty, district, slug",
      "id, name, specialty, slug, is_test_profile, latitude, longitude",
      "id, name, specialty, slug, is_test_profile",
      "id, name, specialty, slug, latitude, longitude",
      "id, name, specialty, slug",
    ];

    for (const selectClause of registeredSelectAttempts) {
      const result = await fetchAllSupabaseRows(() =>
        supabase
          .from("doctors")
          .select(selectClause)
          .eq("status", "verified")
          .not("slug", "is", null)
          .order("name", { ascending: true }),
      );

      if (result.error) {
        if (isRecoverableSelectSchemaError(result.error)) {
          continue;
        }
        dataWarning = "Could not load registered professionals.";
        break;
      }

      const resultRows = (result.data ?? []) as unknown[];
      registeredRows = resultRows
        .map((row) => {
          const raw =
            row && typeof row === "object" ? (row as Record<string, unknown>) : ({} as Record<string, unknown>);
          return {
            id: String(raw.id ?? ""),
            name: String(raw.name ?? "Professional"),
            displayName: doctorDashboardDisplayName(String(raw.name ?? "Professional")),
            isSpecialtyApproved:
              (raw.is_specialty_approved as boolean | null | undefined) !== false,
            specialty: getPublicSpecialtyDisplayLabel({
              specialty: (raw.specialty as string | null) ?? null,
              is_specialty_approved: raw.is_specialty_approved as boolean | null,
            }),
            district: (raw.district as string | null) ?? null,
            slug: (raw.slug as string | null) ?? null,
            email: (raw.email as string | null) ?? null,
            languages: normalizeLanguages(raw.languages),
            avatarUrl: toPublicAvatarUrl(raw.avatar_url),
            isTestProfile: Boolean(raw.is_test_profile ?? false),
            clinic_address: (raw.clinic_address as string | null) ?? null,
            isGesy: Boolean(raw.is_gesy ?? false),
            latitude: parseOptionalCoordinates(raw.latitude, raw.longitude)?.latitude ?? null,
            longitude: parseOptionalCoordinates(raw.latitude, raw.longitude)?.longitude ?? null,
          };
        })
        .filter(
          (row) =>
            !isRegisteredDoctorHiddenFromFinder({
              name: row.name,
              slug: row.slug,
              email: row.email,
              isTestProfile: row.isTestProfile,
            })
        );
      break;
    }

    let manualRowsRaw: Array<{
      id: string;
      slug?: string | null;
      name: string | null;
      specialty: string | null;
      district: CyprusDistrict;
      address_maps_link: string | null;
      phone?: string | null;
      address?: string | null;
      is_gesy?: boolean | null;
      latitude?: unknown;
      longitude?: unknown;
      clinic_id?: string | null;
      gender?: string | null;
    }> = [];
    const manualSelectAttempts = [
      "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender",
      "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id",
      "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude",
      "id, slug, name, specialty, district, address_maps_link, phone, address, latitude, longitude",
      "id, slug, name, specialty, district, address_maps_link, phone, latitude, longitude",
      "id, name, specialty, district, address_maps_link, phone, latitude, longitude",
      "id, name, specialty, district, address_maps_link, latitude, longitude",
      "id, name, specialty, district, address_maps_link",
    ];
    let manualLoadError: { code?: string; message?: string } | null = null;
    for (const selectClause of manualSelectAttempts) {
      const manualRes = await fetchAllSupabaseRows(() =>
        supabase
          .from("directory_manual")
          .select(selectClause)
          .eq("is_archived", false)
          .order("name", { ascending: true }),
      );
      if (manualRes.error) {
        manualLoadError = manualRes.error;
        if (isRecoverableSelectSchemaError(manualRes.error)) {
          continue;
        }
        break;
      }
      manualRowsRaw = ((manualRes.data ?? []) as unknown) as Array<{
        id: string;
        slug?: string | null;
        name: string | null;
        specialty: string | null;
        district: CyprusDistrict;
        address_maps_link: string | null;
        phone?: string | null;
        address?: string | null;
        is_gesy?: boolean | null;
        latitude?: unknown;
        longitude?: unknown;
        clinic_id?: string | null;
        gender?: string | null;
      }>;
      manualLoadError = null;
      break;
    }

    if (manualLoadError) {
      dataWarning = dataWarning ?? "Could not load manual directory entries.";
    } else {
      const monthlySinceIso = finderManualVoteBadgeSinceIso();
      const monthlyRequestCountByManualId = new Map<string, number>();

      const { data: monthlyRequestRows, error: monthlyRequestErr } = await supabase
        .from("directory_manual_patient_booking_requests")
        .select("id, manual_id, voter_key")
        .gte("created_at", monthlySinceIso)
        .limit(12000);

      if (!monthlyRequestErr && monthlyRequestRows?.length) {
        const votersByManual = new Map<string, Set<string>>();
        for (const r of monthlyRequestRows) {
          const mid = String((r as { manual_id?: string }).manual_id ?? "");
          const id = String((r as { id?: string }).id ?? "");
          const vk = (r as { voter_key?: string | null }).voter_key?.trim();
          const dedupeId = vk || `legacy:${id}`;
          if (!mid) continue;
          const cur = votersByManual.get(mid);
          if (!cur) {
            votersByManual.set(mid, new Set([dedupeId]));
          } else {
            cur.add(dedupeId);
          }
        }
        for (const [mid, voters] of Array.from(votersByManual.entries())) {
          monthlyRequestCountByManualId.set(mid, voters.size);
        }
      }

      const clinicIds = Array.from(
        new Set(
          manualRowsRaw
            .map((row) => String(row.clinic_id ?? "").trim())
            .filter(Boolean),
        ),
      );
      const clinicById = new Map<string, { name: string; slug: string }>();
      if (clinicIds.length > 0) {
        const clinicsRes = await supabase
          .from("clinics")
          .select("id, name, slug")
          .eq("is_archived", false)
          .in("id", clinicIds);
        if (!clinicsRes.error && clinicsRes.data?.length) {
          for (const c of clinicsRes.data) {
            const id = String((c as { id?: string }).id ?? "");
            const name = String((c as { name?: string }).name ?? "").trim();
            const slug = String((c as { slug?: string }).slug ?? "").trim();
            if (id && name && slug) {
              clinicById.set(id, { name, slug });
            }
          }
        }
      }

      manualRows = manualRowsRaw.map((row) => {
        const addressMapsLink = String(row.address_maps_link ?? "");
        const manualId = row.id as string;
        const clinicId = String(row.clinic_id ?? "").trim();
        return {
          id: manualId,
          slug: String(row.slug ?? "").trim() || null,
          name: String(row.name ?? "Professional"),
          displayName: doctorDashboardDisplayName(String(row.name ?? "Professional")),
          specialty: String(row.specialty ?? "Specialty not set"),
          district: row.district as CyprusDistrict,
          address_maps_link: addressMapsLink,
          phone: String(row.phone ?? "").trim() || null,
          address: String(row.address ?? "").trim() || null,
          photoUrl: resolveFinderDisplayPhotoUrl({
            curatedOrCustomPhotoUrl: getFinderManualPhotoUrl(addressMapsLink),
            gender: row.gender,
          }),
          monthlyRequestCount: monthlyRequestCountByManualId.get(manualId) ?? 0,
          isGesy: Boolean(row.is_gesy ?? false),
          latitude: parseOptionalCoordinates(row.latitude, row.longitude)?.latitude ?? null,
          longitude: parseOptionalCoordinates(row.latitude, row.longitude)?.longitude ?? null,
          clinic: clinicId ? clinicById.get(clinicId) ?? null : null,
        };
      });
    }
  } else {
    dataWarning = "Finder is not configured. Missing Supabase service credentials.";
  }

  const filteredRegistered = registeredRows.filter((row) => {
    if (
      activeDistrict &&
      normalizeDistrictTerm(row.district ?? "") !== normalizeDistrictTerm(activeDistrict)
    ) {
      return false;
    }
    if (
      !matchesFinderSpecialtyFilter({
        specialty: row.specialty,
        is_specialty_approved: row.isSpecialtyApproved,
        activeSpecialty,
        matchesSpecialty: matchesSpecialtyFilter,
      })
    ) {
      return false;
    }
    if (
      activeName &&
      !row.displayName.toLowerCase().includes(activeName.toLowerCase()) &&
      !row.name.toLowerCase().includes(activeName.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const finderSpecialtyOptions = buildFinderSpecialtyOptions(manualRows, registeredRows);

  const filteredManual = manualRows.filter((row) => {
    if (
      activeDistrict &&
      normalizeDistrictTerm(row.district) !== normalizeDistrictTerm(activeDistrict)
    ) {
      return false;
    }
    if (activeSpecialty && !matchesSpecialtyFilter(row.specialty, activeSpecialty)) {
      return false;
    }
    if (
      activeName &&
      !row.displayName.toLowerCase().includes(activeName.toLowerCase()) &&
      !row.name.toLowerCase().includes(activeName.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  let testDoctorAvailabilityCalendars = new Map<string, PublicAvailabilityCalendar>();
  let registeredOnlineBookingsPaused = new Map<string, boolean>();
  if (supabase) {
    const registeredDoctorIds = filteredRegistered.map((row) => row.id);
    if (registeredDoctorIds.length > 0) {
      registeredOnlineBookingsPaused = await loadOnlineBookingsPausedByDoctorId(
        supabase,
        registeredDoctorIds,
      );
    }

    const testDoctorIds = filteredRegistered
      .filter((row) =>
        isTestProfileLike({
          name: row.name,
          slug: row.slug,
          email: row.email,
          isTestProfile: row.isTestProfile,
        }),
      )
      .map((row) => row.id);
    if (testDoctorIds.length > 0) {
      testDoctorAvailabilityCalendars = await loadAvailabilityCalendarsByDoctorId(
        supabase,
        testDoctorIds,
      );
    }
  }

  function computeDistanceInfo(
    _district: string | null | undefined,
    latitude: number | null,
    longitude: number | null,
  ): { distanceKm: number | null; usedDistrictFallbackForDistance: boolean } {
    return {
      distanceKm: computeFinderDistanceKm(userCoords, latitude, longitude),
      // Always false: district-centre approximate distances are not allowed.
      usedDistrictFallbackForDistance: false,
    };
  }

  const unifiedResults: UnifiedFinderResult[] = [
    ...filteredRegistered.map((row) => {
      const distanceInfo = computeDistanceInfo(row.district, row.latitude, row.longitude);
      return { kind: "registered" as const, row, ...distanceInfo };
    }),
    ...filteredManual.map((row) => {
      const distanceInfo = computeDistanceInfo(row.district, row.latitude, row.longitude);
      return { kind: "manual" as const, row, ...distanceInfo };
    }),
  ];
  if (userCoords) {
    unifiedResults.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }
  const hasRegisteredAvailabilityGrid = filteredRegistered.some((row) => {
    const calendar = testDoctorAvailabilityCalendars.get(row.id);
    return Boolean(calendar && calendar.days.length > 0 && row.slug);
  });
  const showFinderAvailabilityWeekNav =
    hasRegisteredAvailabilityGrid || filteredManual.length > 0;
  const stickyWeekAnchorDoctorId = showFinderAvailabilityWeekNav
    ? unifiedResults.find((item) => {
        if (item.kind === "registered") {
          const calendar = testDoctorAvailabilityCalendars.get(item.row.id);
          return Boolean(calendar && calendar.days.length > 0 && item.row.slug);
        }
        return true;
      })?.row.id ?? null
    : null;
  const finderAvailabilityDayHeaders = buildFinderAvailabilityDayHeaders();
  const hasActiveFilters = Boolean(activeDistrict || activeSpecialty || activeName);
  const specialtyLabel = activeSpecialty ? toTitleCaseWords(activeSpecialty) : "Health Professionals";
  const districtLabel = activeDistrict ? toTitleCaseWords(activeDistrict) : "Cyprus";
  const hasSpecificFilters = Boolean(activeDistrict && activeSpecialty);
  const finderH1 = hasSpecificFilters
    ? `${specialtyLabel} in ${districtLabel}`
    : "Find your next health professional in Cyprus";
  const finderSnippet = hasSpecificFilters
    ? `Find English-speaking ${specialtyLabel} in ${districtLabel}. Compare profiles and book online with confidence.`
    : null;
  const finderPath = finderResultsPath(
    activeDistrict || null,
    activeSpecialty || null,
  );
  const schemaEntries = unifiedResults.map((item) => {
    if (item.kind === "registered") {
      const row = item.row;
      const profileUrl = row.slug ? `${siteUrl}/${row.slug}` : null;
      return {
        name: row.displayName,
        specialty: row.specialty ?? "General Practice",
        district: (row.district ?? activeDistrict) || null,
        profileUrl,
        mapsUrl: null,
      };
    }

    const row = item.row;
    return {
      name: row.displayName,
      specialty: row.specialty,
      district: row.district,
      profileUrl: null,
      mapsUrl: row.address_maps_link,
    };
  });

  return (
    <main className="min-h-screen bg-ink-50 text-ink-800">
      <FinderStructuredData
        siteUrl={siteUrl}
        finderPath={finderPath}
        entries={schemaEntries}
        activeDistrict={activeDistrict}
        activeSpecialty={activeSpecialty}
      />
      <header className="px-4 pt-8 pb-8 sm:px-6 sm:pb-0 lg:px-8">
        <PendingLink href="/" className="inline-flex transition hover:opacity-90">
          <DocCyWordmark variant="light" />
        </PendingLink>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
        <FinderHeroSection
          title={finderH1}
          showHeroImage={!hasSpecificFilters}
          subtitleClassName={
            hasSpecificFilters
              ? "mt-3 max-w-2xl text-base leading-relaxed text-ink-600"
              : "mt-3 max-w-2xl text-lg leading-relaxed text-ink-600 sm:text-xl"
          }
          subtitle={
            hasSpecificFilters ? (
              finderSnippet
            ) : (
              <>
                <span className="block">English-speaking specialists, ready to book online,</span>
                <span className="mt-1 block font-medium text-clinical-600">in just a few clicks.</span>
              </>
            )
          }
        >
          <section className="relative overflow-hidden rounded-3xl border border-clinical-200 bg-white p-5 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_28px_rgba(11,123,181,0.08)] sm:p-6 lg:p-8">
            <FinderAudienceToggle active="professionals" className="mb-5" />
            <FinderFilters
              districts={districts}
              activeDistrict={activeDistrict}
              activeSpecialty={activeSpecialty}
              activeName={activeName}
              activeLatitude={userCoords?.latitude ?? null}
              activeLongitude={userCoords?.longitude ?? null}
              specialtyOptions={finderSpecialtyOptions}
            />
            <FinderResultsCount
              count={unifiedResults.length}
              hasActiveFilters={hasActiveFilters}
              districtLabel={activeDistrict ? districtLabel : undefined}
              specialtyLabel={activeSpecialty ? specialtyLabel : undefined}
              activeName={activeName || undefined}
              variant="footer"
            />
          </section>
        </FinderHeroSection>

        <FinderResultsTransition>
          {dataWarning ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {dataWarning}
            </div>
          ) : null}

          <section className="mt-6">
            <FinderResultsAvailabilityShell dayHeaders={finderAvailabilityDayHeaders}>
              <div className="flex flex-col gap-4">
                {unifiedResults.map((item) => {
                if (item.kind === "registered") {
                  const row = item.row;
                  const availabilityCalendar = testDoctorAvailabilityCalendars.get(row.id);
                  const onlineBookingsPaused =
                    registeredOnlineBookingsPaused.get(row.id) ?? false;
                  const showAvailabilityGrid = Boolean(
                    availabilityCalendar && availabilityCalendar.days.length > 0 && row.slug,
                  );
                  const showPausedNotice = Boolean(
                    onlineBookingsPaused && row.slug && !showAvailabilityGrid,
                  );
                  const showRightColumn = showAvailabilityGrid || showPausedNotice;
                  return (
                    <article
                      key={`registered-${row.id}`}
                      className={`rounded-2xl border border-clinical-200 bg-white p-4 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_4px_16px_rgba(11,123,181,0.05)] sm:p-5 ${finderRegisteredCardRowClass}`}
                    >
                      <div
                        className={`flex min-w-0 shrink-0 items-start gap-3 ${finderRegisteredIdentityColumnClass}`}
                      >
                        {row.slug ? (
                          <PendingLink
                            href={`/${row.slug}`}
                            navigationReason="profile"
                            fill
                            prefetch={false}
                            aria-label={`View ${row.displayName} booking page`}
                            className="group h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-clinical-50 ring-2 ring-clinical-100 transition-none hover:border-clinical-300 hover:ring-clinical-200"
                          >
                            {row.avatarUrl ? (
                              <img
                                src={row.avatarUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-clinical-700">
                                {getInitials(row.displayName)}
                              </div>
                            )}
                          </PendingLink>
                        ) : (
                          <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-clinical-50 ring-2 ring-clinical-100">
                            {row.avatarUrl ? (
                              <img
                                src={row.avatarUrl}
                                alt={`${row.displayName} profile photo`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-clinical-700">
                                {getInitials(row.displayName)}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 flex flex-col items-stretch gap-2 text-left">
                          {row.slug ? (
                            <PendingLink
                              href={`/${row.slug}`}
                              navigationReason="profile"
                              prefetch={false}
                              className="text-left text-[17px] font-bold leading-[1.2] tracking-tight text-ink-900 transition-none hover:text-clinical-600"
                            >
                              {row.displayName}
                            </PendingLink>
                          ) : (
                            <p className="text-[17px] font-bold leading-[1.2] tracking-tight text-ink-900">
                              {row.displayName}
                            </p>
                          )}
                          <FinderSpecialtyLink
                            specialty={row.specialty ?? "Specialty not set"}
                            className="-ml-2 inline-flex max-w-full items-center self-start rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-600 transition-none hover:border-clinical-300 hover:bg-clinical-50 hover:text-clinical-800"
                          >
                            <span className="whitespace-normal break-words leading-snug">
                              {row.specialty ?? "Specialty not set"}
                            </span>
                          </FinderSpecialtyLink>
                          {row.isGesy ? (
                            <div className="self-start">
                              <GesyProviderBadge size="sm" language="en" />
                            </div>
                          ) : null}
                          {item.distanceKm !== null ? (
                            <p className="text-xs font-semibold text-clinical-700">
                              {formatDistanceAway(item.distanceKm)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className={finderRegisteredDetailsSectionClass}>
                        <div
                          className={
                            showRightColumn ? finderRegisteredCardDetailsGridClass : ""
                          }
                        >
                          <div className="space-y-4">
                            <div>
                              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                                Speaks
                              </p>
                              {row.languages.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {row.languages.slice(0, 4).map((language, index) => {
                                    const theme = languageThemeForLabel(language);
                                    return (
                                      <span
                                        key={`${theme.label}-${index}`}
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-snug ${theme.pillClass}`}
                                        title={theme.label}
                                      >
                                        <span>{theme.label}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-ink-400">Not specified</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs leading-relaxed text-ink-600 whitespace-pre-wrap break-words">
                                {row.clinic_address?.trim()
                                  ? row.clinic_address.trim()
                                  : "Not provided yet"}
                              </p>
                            </div>
                          </div>
                          {showAvailabilityGrid && availabilityCalendar && row.slug ? (
                            <div className="min-w-0">
                              <FinderCardAvailabilityGrid
                                calendar={availabilityCalendar}
                                profileSlug={row.slug}
                                anchorStickyWeekNav={row.id === stickyWeekAnchorDoctorId}
                              />
                            </div>
                          ) : showPausedNotice && row.slug ? (
                            <div className="min-w-0">
                              <FinderCardOnlineBookingPaused profileSlug={row.slug} />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                }

                const row = item.row;
                const manualLandingHref = row.slug
                  ? manualDirectoryLandingPath(row.slug)
                  : null;
                return (
                  <article
                    key={`manual-${row.id}`}
                    className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className={finderRegisteredCardRowClass}>
                      <div
                        className={`flex min-w-0 shrink-0 items-start gap-3 ${finderRegisteredIdentityColumnClass}`}
                      >
                      {manualLandingHref ? (
                        <PendingLink
                          href={manualLandingHref}
                          navigationReason="profile"
                          fill
                          prefetch={false}
                          aria-label={`View ${row.displayName} directory profile`}
                        className={`group h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border bg-ink-50 ring-2 transition-none hover:border-clinical-300 hover:ring-clinical-200 border-clinical-200 ring-clinical-100`}
                        >
                          <img
                            src={row.photoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </PendingLink>
                      ) : (
                        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-ink-50 ring-2 ring-clinical-100">
                          <img
                            src={row.photoUrl}
                            alt={`${row.displayName} profile photo`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 flex flex-col items-stretch gap-2 text-left">
                        {manualLandingHref ? (
                          <PendingLink
                            href={manualLandingHref}
                            navigationReason="profile"
                            prefetch={false}
                            className="text-left text-[17px] font-bold leading-[1.2] tracking-tight text-ink-900 transition-none hover:text-clinical-600"
                          >
                            {row.displayName}
                          </PendingLink>
                        ) : (
                          <p className="text-[17px] font-bold leading-[1.2] tracking-tight text-ink-900">
                            {row.displayName}
                          </p>
                        )}
                        <FinderSpecialtyLink
                          specialty={row.specialty}
                          className="-ml-2 inline-flex max-w-full items-center self-start rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-600 transition-none hover:border-clinical-300 hover:bg-clinical-50 hover:text-clinical-800"
                        >
                          <span className="whitespace-normal break-words leading-snug">
                            {row.specialty}
                          </span>
                        </FinderSpecialtyLink>
                        {row.isGesy ? (
                          <div className="self-start">
                            <GesyProviderBadge size="sm" language="en" />
                          </div>
                        ) : null}
                        {item.distanceKm !== null ? (
                          <p className="mt-2 text-xs font-semibold text-clinical-700">
                            {formatDistanceAway(item.distanceKm)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className={finderRegisteredDetailsSectionClass}>
                      <div className={finderRegisteredCardDetailsGridClass}>
                        <div className="space-y-4">
                          <FinderClinicLocationBlock
                            district={row.district}
                            address={row.address}
                            addressMapsLink={row.address_maps_link}
                            clinic={row.clinic}
                          />
                        </div>
                        <div className="min-w-0 flex flex-col gap-2">
                          <ManualDirectoryMonthlyRequestBadge
                            monthlyRequestCount={row.monthlyRequestCount}
                          />
                          <FinderManualCardAvailabilityGrid
                            manualId={row.id}
                            doctorName={row.displayName}
                            addressMapsLink={row.address_maps_link}
                            phone={row.phone}
                            addressText={row.address}
                            anchorStickyWeekNav={row.id === stickyWeekAnchorDoctorId}
                          />
                        </div>
                      </div>
                    </div>
                    </div>

                    <div
                      className={`${finderCardManualFooterClass} flex flex-wrap items-end justify-between gap-x-4 gap-y-2`}
                    >
                      <ManualDirectoryDoctorClaimFooter />
                      <ManualDirectoryReportIncorrectInfoLink
                        displayName={row.displayName}
                        specialty={row.specialty}
                        district={row.district}
                        className="ml-auto shrink-0 text-right"
                      />
                    </div>
                  </article>
                );
              })}
              {unifiedResults.length === 0 ? (
                <FinderMissingDoctorCard
                  specialtyLabel={activeSpecialty ? specialtyLabel : null}
                  districtLabel={activeDistrict ? districtLabel : null}
                  activeSpecialty={activeSpecialty}
                  activeDistrict={activeDistrict}
                  activeSearchName={activeName}
                />
              ) : null}
              </div>
            </FinderResultsAvailabilityShell>
          </section>

          <footer className="mt-12 border-t border-ink-200 pt-6 pb-2">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <section className="w-full">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                  Popular Healthcare Searches in Cyprus
                </h2>

                <details className="mt-3 rounded-xl border border-ink-200 bg-white p-3 md:hidden">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-800">
                    Explore by city and specialty
                  </summary>
                  <div className="mt-3 grid gap-4">
                    {SEO_CITIES.map((city) => (
                      <section key={`mobile-${city}`}>
                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-clinical-600">
                          {city}
                        </h3>
                        <ul className="mt-2 space-y-1.5">
                          {SEO_SPECIALTIES.map((specialty) => (
                            <li key={`${city}-${specialty.label}-mobile`}>
                              <a
                                href={finderResultsPath(city, specialty.label)}
                                className="text-sm text-ink-700 underline underline-offset-4 transition hover:text-clinical-600"
                              >
                                {specialty.pluralLabel} in {city}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </details>

                <div className="mt-3 hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-4">
                  {SEO_CITIES.map((city) => (
                    <section key={`desktop-${city}`}>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-clinical-300">
                        {city}
                      </h3>
                      <ul className="mt-2 space-y-1.5">
                        {SEO_SPECIALTIES.map((specialty) => (
                          <li key={`${city}-${specialty.label}-desktop`}>
                            <a
                              href={finderResultsPath(city, specialty.label)}
                              className="text-xs text-ink-600 underline underline-offset-4 transition hover:text-clinical-600"
                            >
                              {specialty.pluralLabel} in {city}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </section>

              <section className="md:max-w-sm">
                <p className="text-xs text-ink-500">
                  Are you a healthcare professional?{" "}
                  <PendingLink
                    href={`${FOR_PROFESSIONALS_PATH}#founders-pricing`}
                    className="font-semibold text-clinical-600 underline underline-offset-4 transition hover:text-clinical-500"
                  >
                    List your practice
                  </PendingLink>
                  .
                </p>
                <a
                  href="https://www.instagram.com/doccy_cyprus?igsh=MW94Zjg1czZ6OXNzaw=="
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 transition hover:border-clinical-300 hover:text-clinical-600"
                  aria-label="Follow DocCy on Instagram"
                >
                  <Instagram className="h-4 w-4" aria-hidden />
                </a>
              </section>
            </div>
          </footer>

          <FinderFaqSection
            siteUrl={siteUrl}
            finderPath={finderPath}
            specialtyLabel={specialtyLabel}
            districtLabel={districtLabel}
            hasSpecificFilters={hasSpecificFilters}
          />
        </FinderResultsTransition>
      </div>
    </main>
  );
}

