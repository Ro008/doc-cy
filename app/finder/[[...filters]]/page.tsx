import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Instagram } from "lucide-react";
import { FinderPublicHeader } from "@/components/finder/FinderPublicHeader";
import { PendingLink } from "@/components/navigation/PendingLink";
import { CYPRUS_DISTRICTS, type CyprusDistrict, isCyprusDistrict } from "@/lib/cyprus-districts";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  fetchAllSupabaseRows,
  fetchAllSupabaseRowsForIdChunks,
} from "@/lib/supabase-fetch-all";
import { loadDoctorLocationsByDoctorIds } from "@/lib/load-doctor-locations";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { FinderAudienceToggle } from "@/components/finder/FinderAudienceToggle";
import { FinderFilters } from "@/components/finder/FinderFilters";
import { FinderMissingDoctorCard } from "@/components/finder/FinderMissingDoctorCard";
import { FinderHeroBookOnlineLine } from "@/components/finder/FinderHeroBookOnlineLine";
import { FinderHeroSection } from "@/components/finder/FinderHeroSection";
import { FinderRecentlyViewed } from "@/components/finder/FinderRecentlyViewed";
import { FinderResultsCount } from "@/components/finder/FinderResultsCount";
import { FinderResultsTransition } from "@/components/finder/FinderResultsTransition";
import FinderSearchRouteLoading from "@/components/finder/FinderSearchRouteLoading";
import { FinderSearchBar } from "@/components/finder/FinderSearchBar";
import { FinderStructuredData } from "@/components/finder/FinderStructuredData";
import { FinderFaqSection } from "@/components/finder/FinderFaqSection";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderLoadMoreButton } from "@/components/finder/FinderLoadMoreButton";
import { FinderSpecialtyPills } from "@/components/finder/FinderSpecialtyPills";
import {
  ManualDirectoryDoctorClaimFooter,
  ManualDirectoryReportIncorrectInfoLink,
} from "@/components/finder/ManualDirectoryPatientActions";
import {
  FinderCardAvailabilitySkeleton,
  FinderRegisteredCardAvailability,
} from "@/components/finder/FinderRegisteredCardAvailability";
import { FinderCardLanguages } from "@/components/finder/FinderCardLanguages";
import { FinderManualLocationCalendars } from "@/components/finder/FinderManualLocationCalendars";
import { FinderResultsAvailabilityShell } from "@/components/finder/FinderResultsAvailabilityShell";
import {
  finderRegisteredCardRowClass,
  finderRegisteredDetailsSectionClass,
  finderRegisteredIdentityColumnClass,
} from "@/components/finder/finder-availability-layout";
import {
  finderCardManualFooterActionsClass,
  finderCardManualFooterClass,
} from "@/components/finder/finder-card-cta";
import {
  finderBrowseRowClass,
  finderBrowseRowCompactClass,
  finderResultCardClass,
  finderSoftButtonClass,
} from "@/components/finder/finder-surface";
import {
  districtToSlug,
  isAllSlug,
  slugToDistrict,
  slugToSpecialty,
  specialtyToSlug,
  toTitleCaseWords,
} from "@/lib/finder-seo";
import { buildFinderSpecialtyOptions } from "@/lib/finder-specialty-options";
import {
  matchesAnySpecialtyFilter,
  matchesSpecialtyFilter,
} from "@/lib/finder-specialty-filter";
import { professionalMatchesDistrictFilter } from "@/lib/manual-directory-clinics";
import {
  inferCyprusTownFromClinic,
  reconcileFinderTownAndDistrict,
  resolveFinderTownQuery,
  townToSlug,
} from "@/lib/cyprus-towns";
import {
  getPublicSpecialtyDisplayLabel,
  matchesFinderSpecialtyFilter,
} from "@/lib/doctor-specialty-public";
import { publicSpecialtyLabels } from "@/lib/doctor-specialties";
import { FinderShuffleSeedCookie } from "@/components/finder/FinderShuffleSeedCookie";
import {
  aggregateBookingRequestStats,
  finderBookingRequestWindowSinceIso,
  mergeManualDirectoryRowsById,
  professionalIdsWithUniqueRequests,
} from "@/lib/finder-booking-request-stats";
import { getFinderManualPhotoUrl } from "@/lib/finder-manual-photos";
import { resolveFinderDisplayPhotoUrl } from "@/lib/finder-default-avatars";
import { finderCardImagePriority } from "@/lib/finder-card-image-priority";
import { finderResultsPath, FOR_PROFESSIONALS_PATH } from "@/lib/finder-public-path";
import { isProSessionHintValue, PRO_SESSION_HINT_COOKIE } from "@/lib/pro-session-hint";
import { buildFinderResultsHeading, buildFinderResultsSnippet } from "@/lib/finder-results-heading";
import {
  buildFinderManualShuffleSeed,
  FINDER_RESULTS_PAGE_SIZE,
  hasMoreFinderResults,
  orderUnifiedFinderResultsPhase1,
} from "@/lib/finder-results-paging";
import {
  FINDER_RESULTS_PAGE_COOKIE,
  finderResultsListScope,
  resolveFinderResultsPage,
} from "@/lib/finder-results-page-state";
import {
  FINDER_SHUFFLE_SEED_COOKIE,
  resolveFinderShuffleSeed,
} from "@/lib/finder-shuffle-seed";
import {
  applyFinderListFilters,
  countManualDirectoryForFinder,
  fetchManualDirectoryForFinder,
} from "@/lib/finder-manual-directory-load";
import {
  directoryIdSetCacheKey,
  getCachedDirectoryPayload,
  getCachedDirectoryRows,
} from "@/lib/finder-directory-cache";
import { DOCCY_EXTRA_REGISTRATION_SPECIALTIES } from "@/lib/cyprus-specialties";
import { GESY_MANUAL_SPECIALTIES } from "@/lib/gesy-specialties";
import {
  harmonizeFinderSpecialtyLabel,
  harmonizeFinderSpecialtyList,
} from "@/lib/finder-specialty-harmonize";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { finderIncludesRegisteredTestProfiles, isRegisteredDoctorHiddenFromFinder } from "@/lib/doctor-test-profile";
import { finderAvailabilityRequestKey } from "@/lib/public/finder-availability-request-key";
import { buildFinderAvailabilityDayHeaders } from "@/lib/public/compute-public-booking-slots";
import {
  computeFinderDistanceKm,
  formatApproxDistanceAway,
  formatDistanceAway,
  isApproximateNearMeAccuracy,
  parseFinderNearMeQuery,
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
    town?: string;
    lat?: string;
    lon?: string;
    acc?: string;
    page?: string;
  };
};

type RegisteredFinderRow = {
  id: string;
  name: string;
  displayName: string;
  specialty: string | null;
  /** Approved specialties for pills + filter matching (flat, no primary). */
  specialties: string[];
  district: string | null;
  town?: string | null;
  slug: string | null;
  email: string | null;
  languages: string[];
  avatarUrl: string | null;
  isTestProfile: boolean;
  hasOnlineBooking: boolean;
  /** Address as entered at registration. */
  clinic_address: string | null;
  isGesy: boolean;
  isSpecialtyApproved: boolean;
  latitude: number | null;
  longitude: number | null;
  locations: Array<{
    id: string;
    district: string | null;
    clinic_address: string | null;
    town: string | null;
    latitude: number | null;
    longitude: number | null;
  }>;
};

type ManualFinderRow = {
  id: string;
  slug: string | null;
  name: string;
  displayName: string;
  specialty: string;
  /** Individual GeSY specialties (for multi-specialty filter matching). */
  specialties: string[];
  district: CyprusDistrict;
  town?: string | null;
  address_maps_link: string;
  /** Phone exists server-side; value is revealed via API after click (not in SSR props). */
  hasPhone: boolean;
  address: string | null;
  photoUrl: string;
  /** Unique patients who requested online booking in the last 30 days. */
  monthlyRequestCount: number;
  isGesy: boolean;
  latitude: number | null;
  longitude: number | null;
  clinic: { id?: string | null; name: string; slug: string } | null;
  clinics: Array<{
    id?: string | null;
    name: string;
    slug: string;
    address?: string | null;
    addressMapsLink?: string | null;
    district?: string | null;
    hasPhone?: boolean;
  }>;
};

type UnifiedFinderResult = {
  kind: "registered";
  row: RegisteredFinderRow;
  hasOnlineBooking: boolean;
  isRegistered: true;
  distanceKm: number | null;
  usedDistrictFallbackForDistance: boolean;
} | {
  kind: "manual";
  row: ManualFinderRow;
  hasOnlineBooking: false;
  isRegistered: false;
  distanceKm: number | null;
  usedDistrictFallbackForDistance: boolean;
};

const SEO_CITIES: CyprusDistrict[] = ["Nicosia", "Limassol", "Paphos", "Larnaca"];
const SEO_SPECIALTIES = [
  { label: "Dentist", pluralLabel: "Dentists" },
  { label: "Dermato-Venereology", pluralLabel: "Dermatologists" },
  { label: "Physiotherapist", pluralLabel: "Physiotherapists" },
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
  return parseFinderNearMeQuery(searchParams)?.coords ?? null;
}

function parseNearMeAccuracyMeters(searchParams: FinderPageProps["searchParams"]): number | null {
  return parseFinderNearMeQuery(searchParams)?.accuracyMeters ?? null;
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
    return harmonizeFinderSpecialtyLabel(slugToSpecialty(segment));
  }
  const queryValue = normalizeSelectValue(specialtyQueryParam);
  if (!queryValue || isAllSlug(queryValue)) return "";
  return harmonizeFinderSpecialtyLabel(queryValue);
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

  const genericTitle = "The most complete health directory in Cyprus | Book Online - DocCy";
  const genericDescription =
    "The most complete health directory in Cyprus. Find any specialist, anywhere on the island, and book online.";

  if (districtLabel && specialtyLabel) {
    return {
      title: `${specialtyLabel} in ${districtLabel}, Cyprus | Book Online - DocCy`,
      description: `Find ${specialtyLabel} in ${districtLabel}, Cyprus. Compare profiles and book online.`,
    };
  }

  if (districtLabel) {
    return {
      title: `Health professionals in ${districtLabel}, Cyprus | Book Online - DocCy`,
      description: `Find health professionals in ${districtLabel}, Cyprus. View specialties, locations, and book online.`,
    };
  }

  if (specialtyLabel) {
    return {
      title: `${specialtyLabel} in Cyprus | Book Online - DocCy`,
      description: `Find ${specialtyLabel} across Cyprus. View locations and book online.`,
    };
  }

  return {
    title: genericTitle,
    description: genericDescription,
  };
}

export default function FinderPage(props: FinderPageProps) {
  return (
    <Suspense fallback={<FinderSearchRouteLoading />}>
      <FinderPageContent {...props} />
    </Suspense>
  );
}

async function FinderPageContent({ params, searchParams }: FinderPageProps) {
  const supabase = createServiceRoleClient();
  const activeName = normalizeSelectValue(searchParams?.name);
  const requestedTown = resolveFinderTownQuery(searchParams?.town);
  const reconciled = reconcileFinderTownAndDistrict({
    town: requestedTown,
    district: resolveDistrictValue(params.filters?.[0], searchParams?.district),
  });
  const activeDistrict = reconciled.district;
  const activeTown = reconciled.town;
  const activeSpecialty = resolveSpecialtyValue(params.filters?.[1], searchParams?.specialty);
  const userCoords = parseUserCoordinates(searchParams);
  const nearMeAccuracyMeters = parseNearMeAccuracyMeters(searchParams);
  const nearMeApproximate = isApproximateNearMeAccuracy(nearMeAccuracyMeters);
  const hasListFilter = Boolean(
    activeDistrict || activeSpecialty || activeName || activeTown || userCoords,
  );
  const finderPath = finderResultsPath(
    activeDistrict || null,
    activeSpecialty || null,
  );
  const listScope = finderResultsListScope({
    pathname: finderPath,
    name: activeName || undefined,
    town: activeTown ? townToSlug(activeTown) : undefined,
    lat: searchParams?.lat ?? null,
    lon: searchParams?.lon ?? null,
    acc: searchParams?.acc ?? null,
  });
  const resultsPage = resolveFinderResultsPage({
    cookieRaw: cookies().get(FINDER_RESULTS_PAGE_COOKIE)?.value,
    scope: listScope,
    urlPage: searchParams?.page,
    hasListFilter,
  });
  const shuffleSession = resolveFinderShuffleSeed(
    cookies().get(FINDER_SHUFFLE_SEED_COOKIE)?.value,
  );
  const visibleLimit = resultsPage * FINDER_RESULTS_PAGE_SIZE;
  /**
   * Specialty / district / name / near-me: load the full matching unregistered set
   * so request-count sort is not limited to the first DB page.
   * Unfiltered home stays paged for first paint, then hydrates listings that have
   * 30-day unique booking requests so they can rank above the arbitrary first page.
   */
  const unboundedManualFetch = hasListFilter;
  const manualListLimit = unboundedManualFetch ? undefined : visibleLimit;
  /** Clinic-district extras: same merge cost as before — only with near-me. */
  const loadClinicDistrictExtras = Boolean(userCoords);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const districts = CYPRUS_DISTRICTS;
  const listFilters = {
    district: activeDistrict,
    name: activeName,
    specialty: activeSpecialty,
    town: activeTown,
  };

  let registeredRows: RegisteredFinderRow[] = [];
  let manualRows: ManualFinderRow[] = [];
  let manualDirectoryTotalCount: number | null = null;
  const manualClinicIdByRowId = new Map<string, string>();
  /** Pros whose primary district differs but who practice at a clinic in the active district. */
  const manualIdsWithClinicInActiveDistrict = new Set<string>();
  let finderSpecialtyOptions: ReturnType<typeof buildFinderSpecialtyOptions> = [];
  let dataWarning: string | null = null;
  let bookingStatsById = new Map<
    string,
    { requests30d: number; uniquePatients30d: number }
  >();

  if (supabase) {
    const extrasPromise = (async () => {
      // Clinic-linked extras require an unbounded merge; only with near-me (costly).
      if (!loadClinicDistrictExtras) return;
      if (!(activeTown || activeDistrict)) return;
      const clinicsRes = await getCachedDirectoryRows(
        activeTown
          ? ["clinics-in-town", activeTown, activeDistrict]
          : ["clinics-in-district", activeDistrict],
        () =>
          fetchAllSupabaseRows(() => {
            let q = supabase.from("clinics").select("id").eq("is_archived", false);
            if (activeTown) q = q.eq("town", activeTown);
            else q = q.eq("district", activeDistrict);
            return q;
          }),
      );
      const clinicIds = (clinicsRes.data ?? [])
        .map((row) => String((row as { id?: string }).id ?? "").trim())
        .filter(Boolean);
      if (clinicIds.length === 0) return;
      const linksRes = await fetchAllSupabaseRowsForIdChunks(clinicIds, (clinicIdChunk) =>
        supabase
          .from("professional_clinics")
          .select("professional_id")
          .in("clinic_id", clinicIdChunk),
      );
      for (const link of linksRes.data ?? []) {
        const id = String(
          (link as { professional_id?: string }).professional_id ?? "",
        ).trim();
        if (id) manualIdsWithClinicInActiveDistrict.add(id);
      }
    })();

    const bookingRequestRowsPromise = getCachedDirectoryRows(
      ["booking-requests-30d"],
      () =>
        fetchAllSupabaseRows(() =>
          supabase
            .from("professional_patient_booking_requests")
            .select("id, professional_id, voter_key")
            .gte("created_at", finderBookingRequestWindowSinceIso()),
        ),
    );

    const specialtyOptionsPromise = (async () => {
      const specialtyOptionFilters = {
        district: activeDistrict,
        name: "",
        specialty: "",
      };
      const registeredSpecialtyRes = await getCachedDirectoryRows(
        ["registered-specialties", specialtyOptionFilters.district],
        () =>
          fetchAllSupabaseRows(() =>
            applyFinderListFilters(
              supabase
                .from("professionals")
                .select("specialty")
                .eq("is_registered", true)
                .eq("is_archived", false)
                .eq("status", "verified")
                .not("slug", "is", null),
              specialtyOptionFilters,
            ),
          ),
      );
      const gesyDropdownSeed = GESY_MANUAL_SPECIALTIES.filter(
        (label) => label !== "Pharmacy",
      ).map((specialty) => ({ specialty }));
      const doccyExtraSeed = DOCCY_EXTRA_REGISTRATION_SPECIALTIES.map((specialty) => ({
        specialty,
      }));
      return buildFinderSpecialtyOptions(
        [...gesyDropdownSeed, ...doccyExtraSeed],
        (registeredSpecialtyRes.data ?? []) as { specialty: string | null | undefined }[],
      );
    })();

    const registeredSelectAttempts = [
      "id, name, specialty, specialties, district, town, slug, email, languages, avatar_url, is_test_profile, clinic_address, is_gesy, is_specialty_approved, latitude, longitude, has_online_booking, is_registered",
      "id, name, specialty, specialties, district, town, slug, email, languages, avatar_url, is_test_profile, clinic_address, is_gesy, is_specialty_approved, latitude, longitude",
      "id, name, specialty, specialties, district, slug, email, languages, avatar_url, is_test_profile, clinic_address, is_gesy, is_specialty_approved, latitude, longitude",
      "id, name, specialty, district, town, slug, email, languages, avatar_url, is_test_profile, clinic_address, is_gesy, is_specialty_approved, latitude, longitude",
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
      const result = await getCachedDirectoryRows(
        [
          "registered-professionals",
          selectClause,
          listFilters.district,
          listFilters.name,
          listFilters.specialty,
        ],
        () =>
          fetchAllSupabaseRows(() =>
            applyFinderListFilters(
              supabase
                .from("professionals")
                .select(selectClause)
                .eq("is_registered", true)
                .eq("is_archived", false)
                .eq("status", "verified")
                .not("slug", "is", null),
              // Town is inferred from clinic_address when the column is still empty
              // (doctors who registered before town existed). Filter in memory.
              { ...listFilters, district: "", town: "" },
              {
                specialtyColumn: selectClause.includes("specialties")
                  ? "specialties"
                  : "specialty",
              },
            ).order("name", { ascending: true }),
          ),
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
            specialties: publicSpecialtyLabels({
              specialties: raw.specialties as string[] | null,
              specialty: (raw.specialty as string | null) ?? null,
              is_specialty_approved: raw.is_specialty_approved as boolean | null,
            }),
            district: (raw.district as string | null) ?? null,
            town: inferCyprusTownFromClinic({
              town: (raw.town as string | null) ?? null,
              address: (raw.clinic_address as string | null) ?? null,
            }),
            slug: (raw.slug as string | null) ?? null,
            email: (raw.email as string | null) ?? null,
            languages: normalizeLanguages(raw.languages),
            avatarUrl: toPublicAvatarUrl(raw.avatar_url),
            isTestProfile: Boolean(raw.is_test_profile ?? false),
            hasOnlineBooking: Boolean(raw.has_online_booking ?? true),
            clinic_address: (raw.clinic_address as string | null) ?? null,
            isGesy: Boolean(raw.is_gesy ?? false),
            latitude: parseOptionalCoordinates(raw.latitude, raw.longitude)?.latitude ?? null,
            longitude: parseOptionalCoordinates(raw.latitude, raw.longitude)?.longitude ?? null,
            locations: [],
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

    const locationsByDoctor = await loadDoctorLocationsByDoctorIds(
      supabase,
      registeredRows.map((row) => row.id),
    );
    registeredRows = registeredRows.map((row) => {
      const locs = (locationsByDoctor.get(row.id) ?? []).map((loc) => ({
        id: loc.id,
        district: loc.district,
        clinic_address: loc.clinic_address,
        town: loc.town,
        latitude: parseOptionalCoordinates(loc.latitude, loc.longitude)?.latitude ?? null,
        longitude: parseOptionalCoordinates(loc.latitude, loc.longitude)?.longitude ?? null,
      }));
      const coordCandidates = [
        ...locs.map((loc) =>
          loc.latitude != null && loc.longitude != null
            ? { latitude: loc.latitude, longitude: loc.longitude }
            : null,
        ),
        row.latitude != null && row.longitude != null
          ? { latitude: row.latitude, longitude: row.longitude }
          : null,
      ].filter(Boolean) as Array<{ latitude: number; longitude: number }>;
      const nearest = coordCandidates[0] ?? null;
      return {
        ...row,
        locations: locs,
        latitude: nearest?.latitude ?? row.latitude,
        longitude: nearest?.longitude ?? row.longitude,
      };
    });

    await extrasPromise;
    const bookingRequestRowsRes = await bookingRequestRowsPromise;
    bookingStatsById = aggregateBookingRequestStats(
      (bookingRequestRowsRes.data ?? []).map((r) => ({
        professionalId: String((r as { professional_id?: string }).professional_id ?? ""),
        id: String((r as { id?: string }).id ?? ""),
        voterKey: (r as { voter_key?: string | null }).voter_key ?? null,
      })),
    );
    if (bookingRequestRowsRes.error) {
      console.error("[DocCy] booking request stats failed", bookingRequestRowsRes.error.message);
    }

    let manualRowsRaw: Array<{
      id: string;
      slug?: string | null;
      name: string | null;
      specialty: string | null;
      specialties?: string[] | null;
      district: CyprusDistrict;
      address_maps_link: string | null;
      phone?: string | null;
      address?: string | null;
      is_gesy?: boolean | null;
      latitude?: unknown;
      longitude?: unknown;
      clinic_id?: string | null;
      gender?: string | null;
      finder_visible?: boolean | null;
      town?: string | null;
    }> = [];
    let manualLoadError: { code?: string; message?: string } | null = null;
    let manualUsesSpecialtiesColumn = false;
    let manualSelectClause = "";
    const manualSelectAttempts = [
      "id, slug, name, specialty, specialties, district, town, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender, finder_visible",
      "id, slug, name, specialty, specialties, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender, finder_visible",
      "id, slug, name, specialty, specialties, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender",
      "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender",
      "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id",
      "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude",
      "id, slug, name, specialty, district, address_maps_link, phone, address, latitude, longitude",
      "id, slug, name, specialty, district, address_maps_link, phone, latitude, longitude",
      "id, name, specialty, district, address_maps_link, phone, latitude, longitude",
      "id, name, specialty, district, address_maps_link, latitude, longitude",
      "id, name, specialty, district, address_maps_link",
    ];
    for (const selectClause of manualSelectAttempts) {
      const useSpecialtiesFilter = selectClause.includes("specialties");
      const extraIds = Array.from(manualIdsWithClinicInActiveDistrict);
      const manualRes = await getCachedDirectoryRows(
        [
          "manual-professionals",
          selectClause,
          listFilters.district,
          listFilters.name,
          listFilters.specialty,
          listFilters.town,
          String(manualListLimit ?? "unbounded"),
          directoryIdSetCacheKey(extraIds),
        ],
        () =>
          fetchManualDirectoryForFinder({
            supabase,
            selectClause,
            filters: listFilters,
            specialtyColumn: useSpecialtiesFilter ? "specialties" : "specialty",
            extraDistrictManualIds: extraIds,
            requireFinderVisible: selectClause.includes("finder_visible"),
            orderByName: false,
            limit: manualListLimit,
            source: "professionals",
          }),
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
        specialties?: string[] | null;
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
      manualUsesSpecialtiesColumn = useSpecialtiesFilter;
      manualSelectClause = selectClause;
      break;
    }

    if (
      !unboundedManualFetch &&
      !manualLoadError &&
      manualSelectClause &&
      bookingStatsById.size > 0
    ) {
      const loadedIds = new Set(manualRowsRaw.map((row) => String(row.id ?? "").trim()));
      const missingRequestedIds = professionalIdsWithUniqueRequests(bookingStatsById).filter(
        (id) => !loadedIds.has(id),
      );
      if (missingRequestedIds.length > 0) {
        const requestedRes = await getCachedDirectoryRows(
          [
            "manual-requested-professionals",
            manualSelectClause,
            directoryIdSetCacheKey(missingRequestedIds),
          ],
          () =>
            fetchAllSupabaseRowsForIdChunks(missingRequestedIds, (idChunk) => {
              let q = supabase
                .from("professionals")
                .select(manualSelectClause)
                .eq("is_archived", false)
                .eq("is_registered", false)
                .in("id", idChunk);
              if (manualSelectClause.includes("finder_visible")) {
                q = q.eq("finder_visible", true);
              }
              return q;
            }),
        );
        if (requestedRes.error) {
          console.error(
            "[DocCy] requested listing hydrate failed",
            requestedRes.error.message,
          );
        } else if (requestedRes.data?.length) {
          manualRowsRaw = mergeManualDirectoryRowsById([
            ((requestedRes.data ?? []) as unknown) as typeof manualRowsRaw,
            manualRowsRaw,
          ]);
        }
      }
    }

    finderSpecialtyOptions = await specialtyOptionsPromise;

    if (!manualLoadError) {
      try {
        manualDirectoryTotalCount = await getCachedDirectoryPayload(
          [
            "manual-count-professionals",
            listFilters.district,
            listFilters.name,
            listFilters.specialty,
            listFilters.town,
            manualUsesSpecialtiesColumn ? "specialties" : "specialty",
          ],
          async () => {
            const manualCountRes = await countManualDirectoryForFinder({
              supabase,
              filters: listFilters,
              specialtyColumn: manualUsesSpecialtiesColumn ? "specialties" : "specialty",
              requireFinderVisible: manualUsesSpecialtiesColumn,
              source: "professionals",
            });
            if (manualCountRes.error) {
              throw new Error(manualCountRes.error.message ?? "manual_count_failed");
            }
            return manualCountRes.count;
          },
        );
      } catch {
        manualDirectoryTotalCount = null;
      }
    }

    if (manualLoadError) {
      dataWarning = dataWarning ?? "Could not load manual directory entries.";
    } else {
      manualRows = manualRowsRaw.map((row) => {
        const addressMapsLink = String(row.address_maps_link ?? "");
        const manualId = row.id as string;
        const clinicId = String(row.clinic_id ?? "").trim();
        if (clinicId) manualClinicIdByRowId.set(manualId, clinicId);
        const specialties = Array.isArray(row.specialties)
          ? row.specialties.map((s) => String(s ?? "").trim()).filter(Boolean)
          : [];
        const specialtyParts = harmonizeFinderSpecialtyList(
          specialties.length > 0
            ? specialties
            : [String(row.specialty ?? "").trim()].filter(Boolean),
        );
        return {
          id: manualId,
          slug: String(row.slug ?? "").trim() || null,
          name: String(row.name ?? "Professional"),
          displayName: doctorDashboardDisplayName(String(row.name ?? "Professional")),
          specialty: specialtyParts[0] ?? "Specialty not set",
          specialties: specialtyParts,
          district: row.district as CyprusDistrict,
          town: String((row as { town?: string | null }).town ?? "").trim() || null,
          address_maps_link: addressMapsLink,
          hasPhone: Boolean(String(row.phone ?? "").trim()),
          address: String(row.address ?? "").trim() || null,
          photoUrl: resolveFinderDisplayPhotoUrl({
            curatedOrCustomPhotoUrl: getFinderManualPhotoUrl(addressMapsLink),
            gender: row.gender,
          }),
          monthlyRequestCount: 0,
          isGesy: Boolean(row.is_gesy ?? false),
          latitude: parseOptionalCoordinates(row.latitude, row.longitude)?.latitude ?? null,
          longitude: parseOptionalCoordinates(row.latitude, row.longitude)?.longitude ?? null,
          clinic: null,
          clinics: [],
        };
      });
    }
  } else {
    dataWarning = "Finder is not configured. Missing Supabase service credentials.";
  }

  const filteredRegistered = registeredRows.filter((row) => {
    if (
      activeDistrict &&
      !professionalMatchesDistrictFilter({
        district: row.district,
        clinicDistricts: row.locations.map((loc) => loc.district),
        activeDistrict,
      })
    ) {
      return false;
    }
    if (
      !matchesFinderSpecialtyFilter({
        specialty: row.specialty,
        specialties: row.specialties,
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
    if (activeTown) {
      const rowTown = resolveFinderTownQuery(row.town);
      const locationTowns = row.locations.map((loc) => resolveFinderTownQuery(loc.town));
      if (rowTown !== activeTown && !locationTowns.includes(activeTown)) {
        return false;
      }
    }
    return true;
  });

  const filteredManual = manualRows.filter((row) => {
    if (
      activeDistrict &&
      !professionalMatchesDistrictFilter({
        district: row.district,
        clinicDistricts: row.clinics.map((c) => c.district),
        activeDistrict,
      }) &&
      !manualIdsWithClinicInActiveDistrict.has(row.id)
    ) {
      return false;
    }
    if (
      activeSpecialty &&
      !matchesAnySpecialtyFilter(
        row.specialties.length > 0 ? row.specialties : [row.specialty],
        activeSpecialty,
      )
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
    if (activeTown) {
      const rowTown = resolveFinderTownQuery(row.town);
      if (
        rowTown &&
        rowTown !== activeTown &&
        !manualIdsWithClinicInActiveDistrict.has(row.id)
      ) {
        return false;
      }
    }
    return true;
  });

  for (const row of filteredManual) {
    row.monthlyRequestCount = bookingStatsById.get(row.id)?.uniquePatients30d ?? 0;
  }

  function computeDistanceInfo(
    _district: string | null | undefined,
    latitude: number | null,
    longitude: number | null,
  ): { distanceKm: number | null; usedDistrictFallbackForDistance: boolean } {
    return {
      distanceKm: computeFinderDistanceKm(userCoords, latitude, longitude),
      usedDistrictFallbackForDistance: false,
    };
  }

  const unifiedResults = orderUnifiedFinderResultsPhase1(
    [
      ...filteredRegistered.map((row) => {
        const distanceInfo = computeDistanceInfo(row.district, row.latitude, row.longitude);
        return {
          kind: "registered" as const,
          row,
          hasOnlineBooking: row.hasOnlineBooking,
          isRegistered: true as const,
          ...distanceInfo,
        };
      }),
      ...filteredManual.map((row) => {
        const distanceInfo = computeDistanceInfo(row.district, row.latitude, row.longitude);
        return {
          kind: "manual" as const,
          row,
          hasOnlineBooking: false as const,
          isRegistered: false as const,
          ...distanceInfo,
        };
      }),
    ],
    {
      nearMe: Boolean(userCoords),
      shuffleSeed: buildFinderManualShuffleSeed(listScope, shuffleSession.seed),
      pinTestProfiles: finderIncludesRegisteredTestProfiles(),
      getUnregisteredRequestCount: (item) =>
        item.kind === "manual" ? item.row.monthlyRequestCount : 0,
    },
  );

  const visibleResults = unifiedResults.slice(0, visibleLimit);
  const totalResultsCount =
    (manualDirectoryTotalCount ?? filteredManual.length) + filteredRegistered.length;
  const hasMoreResults = hasMoreFinderResults({
    totalCount: totalResultsCount,
    visibleCount: visibleResults.length,
    resultsPage,
    hasListFilter,
  });
  const visibleRegistered = visibleResults.filter(
    (item): item is Extract<UnifiedFinderResult, { kind: "registered" }> => item.kind === "registered",
  );
  const visibleManual = visibleResults.filter(
    (item): item is Extract<UnifiedFinderResult, { kind: "manual" }> => item.kind === "manual",
  );

  if (supabase) {
    const visibleManualIds = visibleManual.map((item) => item.row.id);

    const loadManualCardExtras = async () => {
      if (visibleManualIds.length === 0) return;
      const clinicIds = Array.from(
        new Set(
          visibleManualIds
            .map((id) => manualClinicIdByRowId.get(id) ?? "")
            .filter(Boolean),
        ),
      );

      const [clinicsRes, linksRes] = await Promise.all([
        clinicIds.length > 0
          ? fetchAllSupabaseRowsForIdChunks(clinicIds, (idChunk) =>
              supabase
                .from("clinics")
                .select("id, name, slug, address, address_maps_link, district, phone")
                .eq("is_archived", false)
                .in("id", idChunk),
            )
          : Promise.resolve({ data: [] as unknown[], error: null }),
        fetchAllSupabaseRowsForIdChunks(visibleManualIds, (idChunk) =>
          supabase
            .from("professional_clinics")
            .select(
              "professional_id, is_primary, clinics ( id, name, slug, address, address_maps_link, district, is_archived, phone )",
            )
            .in("professional_id", idChunk),
        ),
      ]);

      const clinicById = new Map<
        string,
        {
          id: string;
          name: string;
          slug: string;
          address?: string | null;
          addressMapsLink?: string | null;
          district?: string | null;
          hasPhone: boolean;
        }
      >();
      if (!clinicsRes.error && clinicsRes.data?.length) {
        for (const c of clinicsRes.data) {
          const id = String((c as { id?: string }).id ?? "");
          const name = String((c as { name?: string }).name ?? "").trim();
          const slug = String((c as { slug?: string }).slug ?? "").trim();
          if (id && name && slug) {
            clinicById.set(id, {
              id,
              name,
              slug,
              address: String((c as { address?: string | null }).address ?? "").trim() || null,
              addressMapsLink:
                String((c as { address_maps_link?: string | null }).address_maps_link ?? "").trim() ||
                null,
              district:
                String((c as { district?: string | null }).district ?? "").trim() || null,
              hasPhone: Boolean(String((c as { phone?: string | null }).phone ?? "").trim()),
            });
          }
        }
      }

      const clinicsByManualId = new Map<
        string,
        Array<{
          id: string | null;
          name: string;
          slug: string;
          address?: string | null;
          addressMapsLink?: string | null;
          district?: string | null;
          hasPhone: boolean;
        }>
      >();
      if (!linksRes.error && linksRes.data?.length) {
        const sorted = [...linksRes.data].sort((a, b) => {
          const ap = Boolean((a as { is_primary?: boolean }).is_primary);
          const bp = Boolean((b as { is_primary?: boolean }).is_primary);
          if (ap === bp) return 0;
          return ap ? -1 : 1;
        });
        for (const link of sorted) {
          const manualId = String(
            (link as { professional_id?: string }).professional_id ?? "",
          );
          const clinic = (
            link as {
              clinics?: {
                id?: string;
                name?: string;
                slug?: string;
                address?: string | null;
                address_maps_link?: string | null;
                district?: string | null;
                is_archived?: boolean;
                phone?: string | null;
              } | null;
            }
          ).clinics;
          if (!manualId || !clinic || clinic.is_archived) continue;
          const name = String(clinic.name ?? "").trim();
          const slug = String(clinic.slug ?? "").trim();
          if (!name || !slug) continue;
          const clinicId = String(clinic.id ?? "").trim() || null;
          const entry = {
            id: clinicId,
            name,
            slug,
            address: String(clinic.address ?? "").trim() || null,
            addressMapsLink: String(clinic.address_maps_link ?? "").trim() || null,
            district: String(clinic.district ?? "").trim() || null,
            hasPhone: Boolean(String(clinic.phone ?? "").trim()),
          };
          const list = clinicsByManualId.get(manualId) ?? [];
          if (!list.some((c) => (clinicId && c.id === clinicId) || c.slug === entry.slug)) {
            list.push(entry);
            clinicsByManualId.set(manualId, list);
          }
        }
      }

      for (const item of visibleManual) {
        const clinics = clinicsByManualId.get(item.row.id) ?? [];
        if (clinics.length > 0) {
          item.row.clinics = clinics;
          item.row.clinic = clinics[0] ?? null;
        } else {
          const clinicId = manualClinicIdByRowId.get(item.row.id);
          const primary = clinicId ? clinicById.get(clinicId) ?? null : null;
          item.row.clinic = primary;
          item.row.clinics = primary ? [primary] : [];
        }
      }
    };

    await loadManualCardExtras();
  }

  const registeredAvailabilityKey = finderAvailabilityRequestKey(
    visibleRegistered.map((item) => item.row.id),
  );
  const showFinderAvailabilityWeekNav =
    visibleRegistered.some((item) => Boolean(item.row.slug)) || visibleManual.length > 0;
  const stickyWeekAnchorDoctorId = showFinderAvailabilityWeekNav
    ? visibleResults.find((item) => {
        if (item.kind === "registered") return Boolean(item.row.slug);
        return true;
      })?.row.id ?? null
    : null;
  const finderAvailabilityDayHeaders = buildFinderAvailabilityDayHeaders();
  const hasActiveFilters = Boolean(
    activeDistrict || activeSpecialty || activeName || activeTown || userCoords,
  );
  const specialtyLabel = activeSpecialty ? toTitleCaseWords(activeSpecialty) : "Health Professionals";
  const districtLabel = activeDistrict ? toTitleCaseWords(activeDistrict) : "Cyprus";
  const hasSpecificFilters = Boolean(
    activeDistrict || activeSpecialty || activeTown || userCoords,
  );
  const placeLabel = activeTown || (activeDistrict ? districtLabel : null);
  const finderH1 = buildFinderResultsHeading({
    specialtyLabel: activeSpecialty ? specialtyLabel : null,
    districtLabel: placeLabel,
    nearYou: Boolean(userCoords),
  });
  const finderSnippet = buildFinderResultsSnippet({
    specialtyLabel: activeSpecialty ? specialtyLabel : null,
    districtLabel: placeLabel,
    nearYou: Boolean(userCoords),
  });
  const schemaEntries = visibleResults.map((item) => {
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
      <FinderShuffleSeedCookie seed={shuffleSession.seed} persist={shuffleSession.persist} />
      <FinderStructuredData
        siteUrl={siteUrl}
        finderPath={finderPath}
        entries={schemaEntries}
        activeDistrict={activeDistrict}
        activeSpecialty={activeSpecialty}
      />
      <FinderPublicHeader
        proSessionHint={isProSessionHintValue(
          cookies().get(PRO_SESSION_HINT_COOKIE)?.value,
        )}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FinderHeroSection
          title={finderH1}
          showHeroImage={!hasSpecificFilters}
          subtitleClassName="mt-3 max-w-2xl text-lg leading-relaxed text-ink-600 sm:text-xl"
          subtitle={
            <>
              <span className="block">
                {finderSnippet ?? "Find any specialist, anywhere on the island"}
              </span>
              <FinderHeroBookOnlineLine size={hasSpecificFilters ? "compact" : "hero"} />
            </>
          }
        />
      </div>

      <FinderSearchBar
        className={
          hasSpecificFilters
            ? "mt-1"
            : "relative z-20 mt-2 sm:-mt-10 lg:-mt-16"
        }
      >
        <FinderAudienceToggle active="professionals" variant="bar" className="mb-5" />
        <FinderFilters
          districts={districts}
          activeDistrict={activeDistrict}
          activeSpecialty={activeSpecialty}
          activeName={activeName}
          activeTown={activeTown}
          activeLatitude={userCoords?.latitude ?? null}
          activeLongitude={userCoords?.longitude ?? null}
          specialtyOptions={finderSpecialtyOptions}
        />
        <FinderResultsCount
          count={totalResultsCount}
          hasActiveFilters={hasActiveFilters}
          districtLabel={activeDistrict ? districtLabel : undefined}
          specialtyLabel={activeSpecialty ? specialtyLabel : undefined}
          activeName={activeName || undefined}
          townLabel={activeTown || undefined}
          nearMe={Boolean(userCoords)}
          variant="bar"
        />
      </FinderSearchBar>

      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <FinderRecentlyViewed kind="professional" />
        <FinderResultsTransition>
          {dataWarning ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {dataWarning}
            </div>
          ) : null}

          <section className="mt-6">
            <FinderResultsAvailabilityShell dayHeaders={finderAvailabilityDayHeaders}>
              <div className="flex flex-col gap-4">
                {visibleResults.map((item, index) => {
                const imagePriority = finderCardImagePriority(index);
                if (item.kind === "registered") {
                  const row = item.row;
                  const showRightColumn = Boolean(row.slug);
                  return (
                    <article
                      key={`registered-${row.id}`}
                      className={`${finderResultCardClass} ${finderRegisteredCardRowClass}`}
                    >
                      <div
                        className={`flex min-w-0 shrink-0 flex-col gap-3 ${finderRegisteredIdentityColumnClass}`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          {row.slug ? (
                          <PendingLink
                            href={publicProfessionalProfilePath(row.slug)}
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
                                {...imagePriority}
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
                                {...imagePriority}
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
                              href={publicProfessionalProfilePath(row.slug)}
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
                          <FinderSpecialtyPills
                            specialties={row.specialties}
                            specialty={row.specialty ?? "Specialty not set"}
                            className="-ml-2"
                          />
                          {row.isGesy ? (
                            <div className="self-start">
                              <GesyProviderBadge size="xs" language="en" />
                            </div>
                          ) : null}
                          {item.distanceKm !== null ? (
                            <p className="text-xs font-semibold text-clinical-700">
                              {nearMeApproximate
                                ? formatApproxDistanceAway(item.distanceKm)
                                : formatDistanceAway(item.distanceKm)}
                            </p>
                          ) : null}
                        </div>
                        </div>
                        <FinderCardLanguages languages={row.languages} />
                      </div>
                      <div className={finderRegisteredDetailsSectionClass}>
                        {showRightColumn ? (
                          <Suspense fallback={<FinderCardAvailabilitySkeleton />}>
                            <FinderRegisteredCardAvailability
                              doctorId={row.id}
                              profileSlug={row.slug ?? ""}
                              doctorIdsKey={registeredAvailabilityKey}
                              clinicAddress={row.clinic_address}
                              anchorStickyWeekNav={row.id === stickyWeekAnchorDoctorId}
                            />
                          </Suspense>
                        ) : (
                          <div>
                            <p className="text-xs leading-relaxed text-ink-600 whitespace-pre-wrap break-words">
                              {row.clinic_address?.trim()
                                ? row.clinic_address.trim()
                                : "Not provided yet"}
                            </p>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                }

                const row = item.row;
                const manualLandingHref = row.slug
                  ? publicProfessionalProfilePath(row.slug)
                  : null;
                return (
                  <article
                    key={`manual-${row.id}`}
                    className={`flex flex-col gap-4 ${finderResultCardClass}`}
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
                            {...imagePriority}
                          />
                        </PendingLink>
                      ) : (
                        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-ink-50 ring-2 ring-clinical-100">
                          <img
                            src={row.photoUrl}
                            alt={`${row.displayName} profile photo`}
                            className="h-full w-full object-cover"
                            {...imagePriority}
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
                        <FinderSpecialtyPills
                          specialties={row.specialties}
                          specialty={row.specialty}
                          district={row.district}
                          className="-ml-2"
                        />
                        {row.isGesy ? (
                          <div className="self-start">
                            <GesyProviderBadge size="xs" language="en" />
                          </div>
                        ) : null}
                        {item.distanceKm !== null ? (
                          <p className="mt-2 text-xs font-semibold text-clinical-700">
                            {nearMeApproximate
                              ? formatApproxDistanceAway(item.distanceKm)
                              : formatDistanceAway(item.distanceKm)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className={finderRegisteredDetailsSectionClass}>
                      <FinderManualLocationCalendars
                        listing={row}
                        dayHeaders={finderAvailabilityDayHeaders}
                        callToBookSource="finder_card"
                        anchorStickyWeekNav={row.id === stickyWeekAnchorDoctorId}
                      />
                    </div>
                    </div>

                    <div
                      className={`${finderCardManualFooterClass} ${finderCardManualFooterActionsClass}`}
                    >
                      <ManualDirectoryDoctorClaimFooter professionalId={row.id} />
                      <ManualDirectoryReportIncorrectInfoLink
                        displayName={row.displayName}
                        specialty={row.specialty}
                        district={row.district}
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
              {hasMoreResults ? (
                <div className="flex justify-center pt-2">
                  <FinderLoadMoreButton
                    nextPage={resultsPage + 1}
                    scope={listScope}
                    className={finderSoftButtonClass}
                  >
                    Show more professionals
                  </FinderLoadMoreButton>
                </div>
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
                                className={finderBrowseRowClass}
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
                              className={finderBrowseRowCompactClass}
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
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <PendingLink
                    href="/terms"
                    className="text-xs font-semibold text-ink-500 underline underline-offset-4 transition hover:text-clinical-600"
                  >
                    Terms of Use
                  </PendingLink>
                  <PendingLink
                    href="/privacy"
                    className="text-xs font-semibold text-ink-500 underline underline-offset-4 transition hover:text-clinical-600"
                  >
                    Privacy
                  </PendingLink>
                  <a
                    href="https://www.instagram.com/doccy_cyprus?igsh=MW94Zjg1czZ6OXNzaw=="
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 transition hover:border-clinical-300 hover:text-clinical-600"
                    aria-label="Follow DocCy on Instagram"
                  >
                    <Instagram className="h-4 w-4" aria-hidden />
                  </a>
                </div>
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

