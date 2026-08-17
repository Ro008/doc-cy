import type { Metadata } from "next";
import { Suspense } from "react";
import { Instagram } from "lucide-react";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { PendingLink } from "@/components/navigation/PendingLink";
import { CYPRUS_DISTRICTS, type CyprusDistrict, isCyprusDistrict } from "@/lib/cyprus-districts";
import { languageThemeForLabel } from "@/lib/cyprus-languages";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  fetchAllSupabaseRows,
  fetchAllSupabaseRowsForIdChunks,
} from "@/lib/supabase-fetch-all";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { FinderAudienceToggle } from "@/components/finder/FinderAudienceToggle";
import { FinderFilters } from "@/components/finder/FinderFilters";
import { FinderMissingDoctorCard } from "@/components/finder/FinderMissingDoctorCard";
import { FinderHeroSection } from "@/components/finder/FinderHeroSection";
import { FinderRecentlyViewed } from "@/components/finder/FinderRecentlyViewed";
import { FinderResultsCount } from "@/components/finder/FinderResultsCount";
import { FinderResultsTransition } from "@/components/finder/FinderResultsTransition";
import { FinderSearchBar } from "@/components/finder/FinderSearchBar";
import { FinderStructuredData } from "@/components/finder/FinderStructuredData";
import { FinderFaqSection } from "@/components/finder/FinderFaqSection";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderClinicLocationBlock } from "@/components/finder/FinderClinicLocationBlock";
import { FinderSpecialtyPills } from "@/components/finder/FinderSpecialtyPills";
import {
  ManualDirectoryDoctorClaimFooter,
  ManualDirectoryMonthlyRequestBadge,
  ManualDirectoryReportIncorrectInfoLink,
} from "@/components/finder/ManualDirectoryPatientActions";
import {
  FinderCardAvailabilitySkeleton,
  FinderRegisteredCardAvailability,
} from "@/components/finder/FinderRegisteredCardAvailability";
import { FinderManualCardAvailabilityGrid } from "@/components/finder/FinderManualCardAvailabilityGrid";
import { FinderResultsAvailabilityShell } from "@/components/finder/FinderResultsAvailabilityShell";
import {
  finderRegisteredCardDetailsGridClass,
  finderRegisteredCardRowClass,
  finderRegisteredDetailsSectionClass,
  finderRegisteredIdentityColumnClass,
} from "@/components/finder/finder-availability-layout";
import { finderCardManualFooterClass } from "@/components/finder/finder-card-cta";
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
import {
  finderManualVoteBadgeSinceIso,
} from "@/lib/finder-manual-vote-badge";
import { getFinderManualPhotoUrl } from "@/lib/finder-manual-photos";
import { resolveFinderDisplayPhotoUrl } from "@/lib/finder-default-avatars";
import { finderCardImagePriority } from "@/lib/finder-card-image-priority";
import { finderResultsPath, FOR_PROFESSIONALS_PATH } from "@/lib/finder-public-path";
import { buildFinderResultsHeading, buildFinderResultsSnippet } from "@/lib/finder-results-heading";
import {
  buildFinderResultsPageHref,
  FINDER_RESULTS_PAGE_SIZE,
  parseFinderResultsPage,
  pinRegisteredTestProfilesFirst,
} from "@/lib/finder-results-paging";
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
import { manualDirectoryLandingPath } from "@/lib/manual-directory-landing-path";
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
  district: string | null;
  town?: string | null;
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
  /** Individual GeSY specialties (for multi-specialty filter matching). */
  specialties: string[];
  district: CyprusDistrict;
  town?: string | null;
  address_maps_link: string;
  /** Phone exists server-side; value is revealed via API after click (not in SSR props). */
  hasPhone: boolean;
  address: string | null;
  photoUrl: string;
  /** Unique patient requests in the badge rolling window (see finder-manual-vote-badge). */
  monthlyRequestCount: number;
  isGesy: boolean;
  latitude: number | null;
  longitude: number | null;
  clinic: { name: string; slug: string } | null;
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
  const resultsPage = parseFinderResultsPage(searchParams?.page, { hasListFilter });
  const visibleLimit = resultsPage * FINDER_RESULTS_PAGE_SIZE;
  /** Near-me needs the full matching set to sort by distance; otherwise page the query. */
  const unboundedManualFetch = Boolean(userCoords);
  const manualListLimit = unboundedManualFetch ? undefined : visibleLimit;
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

  if (supabase) {
    const extrasPromise = (async () => {
      // Clinic-linked extras require an unbounded merge; skip on paged list loads.
      if (!unboundedManualFetch) return;
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
          .from("directory_manual_clinics")
          .select("directory_manual_id")
          .in("clinic_id", clinicIdChunk),
      );
      for (const link of linksRes.data ?? []) {
        const id = String(
          (link as { directory_manual_id?: string }).directory_manual_id ?? "",
        ).trim();
        if (id) manualIdsWithClinicInActiveDistrict.add(id);
      }
    })();

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
                .from("doctors")
                .select("specialty")
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
          "registered",
          selectClause,
          listFilters.district,
          listFilters.name,
          listFilters.specialty,
        ],
        () =>
          fetchAllSupabaseRows(() =>
            applyFinderListFilters(
              supabase
                .from("doctors")
                .select(selectClause)
                .eq("status", "verified")
                .not("slug", "is", null),
              // Town is inferred from clinic_address when the column is still empty
              // (doctors who registered before town existed). Filter in memory.
              { ...listFilters, town: "" },
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

    await extrasPromise;

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
    }> = [];
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
    let manualLoadError: { code?: string; message?: string } | null = null;
    let manualUsesSpecialtiesColumn = false;
    for (const selectClause of manualSelectAttempts) {
      const useSpecialtiesFilter = selectClause.includes("specialties");
      const extraIds = Array.from(manualIdsWithClinicInActiveDistrict);
      const manualRes = await getCachedDirectoryRows(
        [
          "manual",
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
            orderByName: true,
            limit: manualListLimit,
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
      break;
    }

    finderSpecialtyOptions = await specialtyOptionsPromise;

    if (!manualLoadError) {
      try {
        manualDirectoryTotalCount = await getCachedDirectoryPayload(
          [
            "manual-count",
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
        const specialtyParts =
          specialties.length > 0
            ? specialties
            : [String(row.specialty ?? "").trim()].filter(Boolean);
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
    if (activeTown && resolveFinderTownQuery(row.town) !== activeTown) {
      return false;
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
  } else {
    pinRegisteredTestProfilesFirst(
      unifiedResults,
      finderIncludesRegisteredTestProfiles(),
    );
  }

  const visibleResults = unifiedResults.slice(0, visibleLimit);
  const totalResultsCount =
    (manualDirectoryTotalCount ?? filteredManual.length) + filteredRegistered.length;
  const hasMoreResults = totalResultsCount > visibleResults.length;
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
      const monthlySinceIso = finderManualVoteBadgeSinceIso();
      const clinicIds = Array.from(
        new Set(
          visibleManualIds
            .map((id) => manualClinicIdByRowId.get(id) ?? "")
            .filter(Boolean),
        ),
      );

      const [monthlyRequestRes, clinicsRes, linksRes] = await Promise.all([
        fetchAllSupabaseRowsForIdChunks(visibleManualIds, (idChunk) =>
          supabase
            .from("directory_manual_patient_booking_requests")
            .select("id, manual_id, voter_key")
            .in("manual_id", idChunk)
            .gte("created_at", monthlySinceIso),
        ),
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
            .from("directory_manual_clinics")
            .select(
              "directory_manual_id, is_primary, clinics ( id, name, slug, address, address_maps_link, district, is_archived, phone )",
            )
            .in("directory_manual_id", idChunk),
        ),
      ]);

      const monthlyRequestCountByManualId = new Map<string, number>();
      if (!monthlyRequestRes.error && monthlyRequestRes.data?.length) {
        const votersByManual = new Map<string, Set<string>>();
        for (const r of monthlyRequestRes.data) {
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
            (link as { directory_manual_id?: string }).directory_manual_id ?? "",
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
        item.row.monthlyRequestCount = monthlyRequestCountByManualId.get(item.row.id) ?? 0;
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
    districtLabel: placeLabel || (userCoords ? "your area" : null),
  });
  const finderPath = finderResultsPath(
    activeDistrict || null,
    activeSpecialty || null,
  );
  const loadMoreHref = buildFinderResultsPageHref({
    finderPath,
    name: activeName || undefined,
    town: activeTown ? townToSlug(activeTown) : undefined,
    lat: searchParams?.lat ?? null,
    lon: searchParams?.lon ?? null,
    acc: searchParams?.acc ?? null,
    page: resultsPage + 1,
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
      <FinderStructuredData
        siteUrl={siteUrl}
        finderPath={finderPath}
        entries={schemaEntries}
        activeDistrict={activeDistrict}
        activeSpecialty={activeSpecialty}
      />
      <header className="px-4 pt-8 pb-8 sm:px-6 sm:pb-0 lg:px-8">
        <PendingLink href="/" className="inline-flex transition hover:opacity-90">
          <DocCyWordmark variant="light" size="xl" />
        </PendingLink>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
                          <FinderSpecialtyPills
                            specialties={[]}
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
                          {row.slug ? (
                            <Suspense fallback={<FinderCardAvailabilitySkeleton />}>
                              <FinderRegisteredCardAvailability
                                doctorId={row.id}
                                profileSlug={row.slug}
                                doctorIdsKey={registeredAvailabilityKey}
                                anchorStickyWeekNav={row.id === stickyWeekAnchorDoctorId}
                              />
                            </Suspense>
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
                      <div className={finderRegisteredCardDetailsGridClass}>
                        <div className="space-y-4">
                          <FinderClinicLocationBlock
                            district={row.district}
                            address={row.address}
                            addressMapsLink={row.address_maps_link}
                            clinic={row.clinic}
                            clinics={row.clinics}
                            variant="full"
                            callToBook={{
                              manualId: row.id,
                              listingHasPhone: row.hasPhone,
                              source: "finder_card",
                            }}
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
                            dayHeaders={finderAvailabilityDayHeaders}
                            hasPhone={row.hasPhone}
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
              {hasMoreResults ? (
                <div className="flex justify-center pt-2">
                  <PendingLink
                    href={loadMoreHref}
                    className={finderSoftButtonClass}
                  >
                    Show more professionals
                  </PendingLink>
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

