import type { Metadata } from "next";
import { getSiteScheme } from "@/lib/site-default-scheme";
import { SiteSchemeRoot } from "@/components/site/SiteSchemeRoot";
import { permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { cookies, headers } from "next/headers";
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
import { hasProAccess } from "@/lib/pro-access";
import { primaryClinicLocationFields } from "@/lib/professional-clinic-locations";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { FinderHeaderSearch } from "@/components/finder/FinderHeaderSearch";
import { FinderMissingDoctorCard } from "@/components/finder/FinderMissingDoctorCard";
import { FinderRecentlyViewed } from "@/components/finder/FinderRecentlyViewed";
import { FinderResultsCount } from "@/components/finder/FinderResultsCount";
import { FinderResultsTransition } from "@/components/finder/FinderResultsTransition";
import {
  FinderSearchRouteLoadingView,
  readProSessionHint,
} from "@/components/finder/FinderSearchRouteLoading";
import { FinderStructuredData } from "@/components/finder/FinderStructuredData";
import { FinderFaqSection } from "@/components/finder/FinderFaqSection";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderLoadMoreButton } from "@/components/finder/FinderLoadMoreButton";
import { FinderFilterPanel } from "@/components/finder/FinderFilterPanel";
import { FinderSpecialtyPills } from "@/components/finder/FinderSpecialtyPills";
import {
  ManualDirectoryDoctorClaimFooter,
  ManualDirectoryReportIncorrectInfoLink,
} from "@/components/finder/ManualDirectoryPatientActions";
import {
  FinderCardAvailabilitySkeleton,
  FinderRegisteredCardAvailability,
  FinderRegisteredPublicCall,
} from "@/components/finder/FinderRegisteredCardAvailability";
import { FinderCardLanguages } from "@/components/finder/FinderCardLanguages";
import { FinderCardRating } from "@/components/finder/FinderCardRating";
import { loadPublishedRatings } from "@/lib/public/load-profile-reviews";
import type { FinderRating } from "@/lib/public/profile-reviews";
import { FinderManualLocationCalendars } from "@/components/finder/FinderManualLocationCalendars";
import { FinderResultsAvailabilityShell } from "@/components/finder/FinderResultsAvailabilityShell";
import {
  finderRegisteredCardRowClass,
  finderRegisteredDetailsSectionClass,
  finderRegisteredIdentityColumnClass,
  finderCardIdentityMinHeightClass,
} from "@/components/finder/finder-availability-layout";
import {
  finderCardFooterHeightClass,
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
import type { FinderSpecialtyOption } from "@/lib/finder-specialty-options";
import {
  findCatalogueSpecialty,
  finderSpecialtyOptionsFromCatalogue,
  catalogueIdsForSpecialtyNames,
  loadScrapedAvailableSpecialtyIds,
  specialtyNames,
  loadSpecialtyEntriesByProfessionalIds,
  catalogueIdsForFinderSlug,
  hasSpecialtySlug,
  loadSpecialtyCatalogue,
  specialtyNamesForRow,
  type CatalogueSpecialty,
} from "@/lib/specialty-catalogue";
import { professionalMatchesDistrictFilter } from "@/lib/manual-directory-clinics";
import {
  inferCyprusTownFromClinic,
  reconcileFinderTownAndDistrict,
  resolveFinderTownQuery,
  townToSlug,
} from "@/lib/cyprus-towns";
import { getPublicSpecialtyDisplayLabel } from "@/lib/doctor-specialty-public";
import { FinderShuffleSeedCookie } from "@/components/finder/FinderShuffleSeedCookie";
import {
  aggregateBookingRequestStats,
  mergeManualDirectoryRowsById,
  professionalIdsWithUniqueRequests,
} from "@/lib/finder-booking-request-stats";
import {
  listingClinicLocations,
  type ListingClinicLocation,
} from "@/lib/listing-clinic-location";
import {
  buildFinderClinicCards,
  orderFinderClinicCards,
  type FinderClinicCard,
} from "@/lib/finder-clinic-cards";
import { manualPreviewSeedKey } from "@/lib/finder-manual-preview-calendar";
import { resolveFinderDisplayPhotoUrl } from "@/lib/finder-default-avatars";
import { finderCardImagePriority } from "@/lib/finder-card-image-priority";
import { finderResultsPath } from "@/lib/finder-public-path";
import { isProSessionHintValue, PRO_SESSION_HINT_COOKIE } from "@/lib/pro-session-hint";
import { buildFinderResultsHeading } from "@/lib/finder-results-heading";
import {
  buildFinderManualShuffleSeed,
  FINDER_RESULTS_PAGE_SIZE,
  hasMoreFinderResults,
} from "@/lib/finder-results-paging";
import {
  FINDER_RESULTS_PAGE_COOKIE,
  finderResultsListScope,
  resolveFinderResultsPage,
} from "@/lib/finder-results-page-state";
import { isFinderBrowseAllowed } from "@/lib/public-api-rate-limit";
import {
  FINDER_SHUFFLE_SEED_COOKIE,
  resolveFinderShuffleSeed,
} from "@/lib/finder-shuffle-seed";
import {
  applyFinderListFilters,
  FINDER_LISTING_SELECT_WITH_SPECIALTIES,
  countUnregisteredClinicCardsForFinder,
  fetchManualDirectoryForFinder,
} from "@/lib/finder-manual-directory-load";
import {
  directoryIdSetCacheKey,
  getCachedDirectoryPayload,
  getCachedDirectoryRows,
} from "@/lib/finder-directory-cache";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { finderIncludesRegisteredTestProfiles, isRegisteredDoctorHiddenFromFinder } from "@/lib/doctor-test-profile";
import { finderAvailabilityRequestKey } from "@/lib/public/finder-availability-request-key";
import { loadFinderAvailabilityForRequest } from "@/lib/public/load-finder-availability-request";
import {
  finderCalendarHasSlotWithin,
  finderCardPassesPanelFilters,
  finderPanelExcludesListings,
  finderPanelFilterKey,
  finderPanelFilterParams,
  hasFinderPanelFilters,
  parseFinderPanelFilters,
} from "@/lib/finder-panel-filters";
import { USER_EVENTS_TABLE } from "@/lib/user-events";
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
    /** The filter panel (Finder G, step 3; `lib/finder-panel-filters.ts`). */
    online?: string;
    when?: string;
    gesy?: string;
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
  latitude: number | null;
  longitude: number | null;
  locations: Array<{
    /** professional_clinics.id */
    id: string;
    clinicId: string;
    district: string | null;
    clinic_address: string | null;
    town: string | null;
    latitude: number | null;
    longitude: number | null;
    pausedOnline: boolean;
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
  photoUrl: string;
  /** Unique patients who requested online booking (lifetime). */
  monthlyRequestCount: number;
  isGesy: boolean;
  /** The listing's clinics (Point E5: its location), in its clinic order. */
  locations: ListingClinicLocation[];
};

/** One card per professional + clinic (user, 2026-10-15). */
type FinderCard =
  | (FinderClinicCard<RegisteredFinderRow> & { kind: "registered" })
  | (FinderClinicCard<ManualFinderRow> & { kind: "manual" });

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

type ActiveSpecialtyFilter = {
  /** Catalogue name, or the harmonized raw value when the catalogue has no match. */
  label: string;
  slug: string;
  /** `specialties.id`; null when the value is not in the catalogue (matches nothing). */
  id: string | null;
  /** Matched only through a legacy spelling; a path segment redirects to `slug`. */
  isAlias: boolean;
  fromPath: boolean;
};

/**
 * Finder specialty from the path segment (or `?specialty=`), resolved against the
 * catalogue. An unknown value still filters, and matches nothing, as before.
 */
function resolveActiveSpecialty(
  catalogue: readonly CatalogueSpecialty[],
  specialtySegment: string | undefined,
  specialtyQueryParam: string | undefined,
): ActiveSpecialtyFilter | null {
  const segment = normalizeSelectValue(decodeSegment(specialtySegment));
  const queryValue = normalizeSelectValue(specialtyQueryParam);
  const fromPath = Boolean(segment);
  const raw = fromPath ? segment : queryValue;
  if (!raw || isAllSlug(raw)) return null;

  const hit = findCatalogueSpecialty(catalogue, raw);
  if (hit) {
    return {
      label: hit.specialty.name,
      slug: hit.specialty.slug,
      id: hit.specialty.id,
      isAlias: hit.isAlias,
      fromPath,
    };
  }
  const label = harmonizeFinderSpecialtyLabel(fromPath ? slugToSpecialty(raw) : raw);
  return { label, slug: specialtyToSlug(label), id: null, isAlias: false, fromPath };
}

/**
 * Legacy spellings in indexed URLs (/limassol/dentistry) 308 to the canonical slug.
 * Called from generateMetadata, which runs before the page streams: a redirect from
 * inside the Suspense boundary would arrive after the 200 headers.
 */
function redirectLegacySpecialtyPath(
  district: string,
  specialty: ActiveSpecialtyFilter | null,
  searchParams: FinderPageProps["searchParams"],
): void {
  if (!specialty?.isAlias || !specialty.fromPath) return;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  const qs = query.toString();
  permanentRedirect(`${finderResultsPath(district || null, specialty.label)}${qs ? `?${qs}` : ""}`);
}

async function loadCatalogueForFinder(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<CatalogueSpecialty[]> {
  if (!supabase) return [];
  try {
    return await loadSpecialtyCatalogue(supabase);
  } catch (err) {
    console.error("[DocCy] specialty catalogue failed", err);
    return [];
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: FinderPageProps): Promise<Metadata> {
  const district = resolveDistrictValue(params.filters?.[0], undefined);
  const catalogue = params.filters?.[1]
    ? await loadCatalogueForFinder(createServiceRoleClient())
    : [];
  const specialty = resolveActiveSpecialty(catalogue, params.filters?.[1], undefined);
  redirectLegacySpecialtyPath(district, specialty, searchParams);
  const cleanDistrict = district.trim();
  const districtLabel = cleanDistrict ? toTitleCaseWords(cleanDistrict) : "";
  // Catalogue names keep their own casing ("Obstetrics - Gynaecology").
  const specialtyLabel = specialty
    ? specialty.id
      ? specialty.label
      : toTitleCaseWords(specialty.label)
    : "";

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

export default async function FinderPage(props: FinderPageProps) {
  // The fallback must not suspend (see FinderSearchRouteLoadingView): read the scheme first.
  const scheme = await getSiteScheme();
  return (
    <SiteSchemeRoot>
      <Suspense
        fallback={
          <FinderSearchRouteLoadingView proSessionHint={readProSessionHint()} scheme={scheme} />
        }
      >
        <FinderPageContent {...props} />
      </Suspense>
    </SiteSchemeRoot>
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
  const catalogue = await loadCatalogueForFinder(supabase);
  const specialtyFilter = resolveActiveSpecialty(
    catalogue,
    params.filters?.[1],
    searchParams?.specialty,
  );
  // Normally already redirected by generateMetadata; kept for any other entry point.
  redirectLegacySpecialtyPath(activeDistrict, specialtyFilter, searchParams);
  const activeSpecialty = specialtyFilter?.label ?? "";
  const activeSpecialtySlug = specialtyFilter?.slug ?? "";
  const userCoords = parseUserCoordinates(searchParams);
  const nearMeAccuracyMeters = parseNearMeAccuracyMeters(searchParams);
  const nearMeApproximate = isApproximateNearMeAccuracy(nearMeAccuracyMeters);
  const panelFilters = parseFinderPanelFilters(searchParams ?? {});
  const hasListFilter = Boolean(
    activeDistrict ||
      activeSpecialty ||
      activeName ||
      activeTown ||
      userCoords ||
      hasFinderPanelFilters(panelFilters),
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
    ...finderPanelFilterParams(panelFilters),
  });
  /**
   * Every search counts against the visitor's IP for the hour, regardless of
   * page depth — catches looping through every district x specialty combo,
   * not just deep pagination on one search (see anti-scraping-security.mdc).
   * Over the limit: silently fall back to page 1, no error shown.
   */
  const resultsPage = isFinderBrowseAllowed(headers())
    ? resolveFinderResultsPage({
        cookieRaw: cookies().get(FINDER_RESULTS_PAGE_COOKIE)?.value,
        scope: listScope,
        urlPage: searchParams?.page,
        hasListFilter,
      })
    : 1;
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const districts = CYPRUS_DISTRICTS;
  const listFilters = {
    district: activeDistrict,
    name: activeName,
    specialty: activeSpecialtySlug,
    // Unknown specialty: an empty list keeps the filter on and matches nothing.
    specialtyIds: specialtyFilter
      ? catalogueIdsForFinderSlug(catalogue, activeSpecialtySlug)
      : undefined,
    town: activeTown,
  };

  let registeredRows: RegisteredFinderRow[] = [];
  let manualRows: ManualFinderRow[] = [];
  /** Cards the unregistered listings make with no filter (one per clinic). */
  let manualCardTotalCount: number | null = null;
  let finderSpecialtyOptions: FinderSpecialtyOption[] = [];
  let dataWarning: string | null = null;
  let bookingStatsById = new Map<
    string,
    { requestTaps: number; uniquePatients: number }
  >();

  if (supabase) {
    const bookingRequestRowsPromise = getCachedDirectoryRows(
      ["online-appointment-votes-all-time"],
      () =>
        fetchAllSupabaseRows(() =>
          supabase
            .from(USER_EVENTS_TABLE)
            .select("id, professional_id, visitor_key")
            .eq("event_type", "request_online_appointment"),
        ),
    );

    const scrapedAvailabilityPromise = loadScrapedAvailableSpecialtyIds(
      supabase,
      activeDistrict,
    ).catch((err) => {
      console.error("[DocCy] finder specialty options failed", err);
      return new Set<string>();
    });

    // Location is not selected here: it comes from the clinics below.
    const registeredSelectAttempts = [
      "id, name, slug, email, languages, avatar_url, is_test_profile, is_gesy, pro_access_until, is_registered",
    ];

    for (const selectClause of registeredSelectAttempts) {
      const result = await getCachedDirectoryRows(
        [
          "registered-professionals",
          selectClause,
          listFilters.district,
          listFilters.name,
        ],
        () =>
          fetchAllSupabaseRows(() =>
            applyFinderListFilters(
              supabase
                .from("professionals")
                .select(selectClause)
                .eq("is_registered", true)
                .eq("is_archived", false)
                .not("slug", "is", null),
              // Place and specialty are matched in memory: the place comes from their
              // clinics (N:M) and specialties from professional_specialties.
              { ...listFilters, district: "", town: "", specialty: "", specialtyIds: undefined },
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
            // Filled from professional_specialties below.
            specialty: null,
            specialties: [],
            // Filled from the clinics below.
            district: null,
            town: null,
            slug: (raw.slug as string | null) ?? null,
            email: (raw.email as string | null) ?? null,
            languages: normalizeLanguages(raw.languages),
            avatarUrl: toPublicAvatarUrl(raw.avatar_url),
            isTestProfile: Boolean(raw.is_test_profile ?? false),
            // Online booking is the pro tier: on while pro_access_until is in the future.
            hasOnlineBooking: hasProAccess(raw.pro_access_until as string | null | undefined),
            clinic_address: null,
            isGesy: Boolean(raw.is_gesy ?? false),
            latitude: null,
            longitude: null,
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

    try {
      const entriesById = await loadSpecialtyEntriesByProfessionalIds(
        supabase,
        registeredRows.map((row) => row.id),
      );
      registeredRows = registeredRows.map((row) => {
        const entries = entriesById.get(row.id) ?? [];
        const names = specialtyNames(entries);
        return {
          ...row,
          specialties: names,
          specialty: getPublicSpecialtyDisplayLabel({ specialty: names[0] ?? null }),
        };
      });
    } catch (err) {
      console.error("[DocCy] registered specialties failed", err);
      dataWarning = dataWarning ?? "Could not load registered professionals.";
    }

    const locationsByDoctor = await loadDoctorLocationsByDoctorIds(
      registeredRows.map((row) => row.id),
    );
    registeredRows = registeredRows.map((row) => {
      const locs = (locationsByDoctor.get(row.id) ?? []).map((loc) => ({
        id: loc.id,
        clinicId: loc.clinic_id ?? loc.id,
        district: loc.district,
        clinic_address: loc.clinic_address,
        town: loc.town,
        latitude: parseOptionalCoordinates(loc.latitude, loc.longitude)?.latitude ?? null,
        longitude: parseOptionalCoordinates(loc.latitude, loc.longitude)?.longitude ?? null,
        pausedOnline: Boolean(loc.pause_online_bookings),
      }));
      // District, town, address and pin come from the clinics only, never from the
      // copies on professionals (Point E): the registration approval creates none.
      const place = primaryClinicLocationFields(locs);
      return {
        ...row,
        locations: locs,
        district: place.district,
        town: inferCyprusTownFromClinic({ town: place.town, address: place.clinic_address }),
        clinic_address: place.clinic_address,
        latitude: place.latitude,
        longitude: place.longitude,
      };
    });

    const bookingRequestRowsRes = await bookingRequestRowsPromise;
    bookingStatsById = aggregateBookingRequestStats(
      (bookingRequestRowsRes.data ?? []).map((r) => ({
        professionalId: String((r as { professional_id?: string }).professional_id ?? ""),
        id: String((r as { id?: string }).id ?? ""),
        voterKey: (r as { visitor_key?: string | null }).visitor_key ?? null,
      })),
    );
    if (bookingRequestRowsRes.error) {
      console.error("[DocCy] booking request stats failed", bookingRequestRowsRes.error.message);
    }

    let manualRowsRaw: Array<{
      id: string;
      slug?: string | null;
      name: string | null;
      specialty_links?: unknown;
      listing_clinics?: unknown;
      is_gesy?: boolean | null;
      gender?: string | null;
    }> = [];
    let manualLoadError: { code?: string; message?: string } | null = null;
    let manualSelectClause = "";
    // Book online: no listing can match, so none is loaded (step 3).
    const manualSelectAttempts = finderPanelExcludesListings(panelFilters)
      ? []
      : [FINDER_LISTING_SELECT_WITH_SPECIALTIES];
    for (const selectClause of manualSelectAttempts) {
      const manualRes = await getCachedDirectoryRows(
        [
          "manual-professionals",
          selectClause,
          listFilters.district,
          listFilters.name,
          listFilters.specialty,
          listFilters.town,
          String(manualListLimit ?? "unbounded"),
        ],
        () =>
          fetchManualDirectoryForFinder({
            supabase,
            selectClause,
            filters: listFilters,
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
      manualRowsRaw = (manualRes.data ?? []) as unknown as typeof manualRowsRaw;
      manualLoadError = null;
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
            fetchAllSupabaseRowsForIdChunks(missingRequestedIds, (idChunk) =>
              supabase
                .from("professionals")
                .select(manualSelectClause)
                .eq("is_archived", false)
                .eq("is_registered", false)
                .in("id", idChunk),
            ),
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

    // Dropdown: specialties with a visible scraped listing in the district (cached),
    // plus those of the registered professionals shown there (already loaded).
    const available = new Set(await scrapedAvailabilityPromise);
    const registeredInDistrict = registeredRows.filter(
      (row) =>
        !activeDistrict ||
        professionalMatchesDistrictFilter({
          district: row.district,
          clinicDistricts: row.locations.map((loc) => loc.district),
          activeDistrict,
        }),
    );
    for (const id of catalogueIdsForSpecialtyNames(
      catalogue,
      registeredInDistrict.flatMap((row) => row.specialties),
    )) {
      available.add(id);
    }
    finderSpecialtyOptions = finderSpecialtyOptionsFromCatalogue(catalogue, available);

    // A filtered search loads every matching listing, so its cards are counted in
    // memory; the unfiltered one pages through them and counts their clinics.
    if (!manualLoadError && !unboundedManualFetch) {
      try {
        manualCardTotalCount = await getCachedDirectoryPayload(
          ["manual-card-count-professionals"],
          async () => {
            const manualCountRes = await countUnregisteredClinicCardsForFinder(supabase);
            if (manualCountRes.error) {
              throw new Error(manualCountRes.error.message ?? "manual_count_failed");
            }
            return manualCountRes.count;
          },
        );
      } catch {
        manualCardTotalCount = null;
      }
    }

    if (manualLoadError) {
      dataWarning = dataWarning ?? "Could not load manual directory entries.";
    } else {
      manualRows = manualRowsRaw.map((row) => {
        const manualId = row.id as string;
        const locations = listingClinicLocations(row);
        const specialtyParts = specialtyNamesForRow(row);
        return {
          id: manualId,
          slug: String(row.slug ?? "").trim() || null,
          name: String(row.name ?? "Professional"),
          displayName: doctorDashboardDisplayName(String(row.name ?? "Professional")),
          specialty: specialtyParts[0] ?? "Specialty not set",
          specialties: specialtyParts,
          photoUrl: resolveFinderDisplayPhotoUrl({
            curatedOrCustomPhotoUrl: null,
            gender: row.gender,
          }),
          monthlyRequestCount: 0,
          isGesy: Boolean(row.is_gesy ?? false),
          locations,
        };
      });
    }
  } else {
    dataWarning = "Finder is not configured. Missing Supabase service credentials.";
  }

  // District and town are matched per clinic when the cards are built.
  const filteredRegistered = registeredRows.filter((row) => {
    if (
      specialtyFilter &&
      !hasSpecialtySlug(row.specialties.map((name) => ({ name })), activeSpecialtySlug)
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

  const filteredManual = manualRows.filter((row) => {
    if (
      specialtyFilter &&
      !hasSpecialtySlug(row.specialties.map((name) => ({ name })), activeSpecialtySlug)
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

  for (const row of filteredManual) {
    row.monthlyRequestCount = bookingStatsById.get(row.id)?.uniquePatients ?? 0;
  }

  const placeFilter = { district: activeDistrict, town: activeTown, coords: userCoords };
  const registeredCards = buildFinderClinicCards(
    filteredRegistered.map((row) => ({
      kind: "registered" as const,
      professionalId: row.id,
      row,
      places: row.locations.map((loc) => ({
        clinicId: loc.clinicId,
        linkId: loc.id,
        district: loc.district,
        town: loc.town,
        latitude: loc.latitude,
        longitude: loc.longitude,
        pausedOnline: loc.pausedOnline,
      })),
      hasProAccess: row.hasOnlineBooking,
    })),
    placeFilter,
  ) as FinderCard[];
  const manualCards = buildFinderClinicCards(
    filteredManual.map((row) => ({
      kind: "manual" as const,
      professionalId: row.id,
      row,
      places: row.locations.map((loc) => ({
        clinicId: loc.clinicId,
        linkId: null,
        district: loc.district,
        town: loc.town,
        latitude: loc.latitude,
        longitude: loc.longitude,
        pausedOnline: true,
      })),
      hasProAccess: false,
    })),
    placeFilter,
  ) as FinderCard[];

  // The filter panel (Finder G, step 3). Today / Next 7 days read each bookable clinic's
  // calendar; only registered professionals have one, and they are few.
  let calendarByLocationId = new Map<string, { slots: readonly unknown[] }[]>();
  if (panelFilters.when !== "any") {
    const bookableIds = Array.from(
      new Set(registeredCards.filter((card) => card.hasOnlineBooking).map((card) => card.professionalId)),
    );
    const availability = await loadFinderAvailabilityForRequest(
      finderAvailabilityRequestKey(bookableIds),
    );
    calendarByLocationId = new Map(
      Array.from(availability.byLocationId, ([id, entry]) => [id, entry.paused ? [] : entry.calendar.days]),
    );
  }
  const panelCards = [...registeredCards, ...manualCards].filter((card) =>
    finderCardPassesPanelFilters(
      {
        hasOnlineBooking: card.hasOnlineBooking,
        isGesy: card.row.isGesy,
      },
      panelFilters,
      {
        hasSlotWithinDays: (days) =>
          finderCalendarHasSlotWithin(
            calendarByLocationId.get(card.place?.linkId ?? "") ?? [],
            days,
          ),
      },
    ),
  );
  const panelRegisteredCount = panelCards.filter((card) => card.kind === "registered").length;

  const orderedCards = orderFinderClinicCards<RegisteredFinderRow | ManualFinderRow>(
    panelCards,
    {
      nearMe: Boolean(userCoords),
      shuffleSeed: buildFinderManualShuffleSeed(listScope, shuffleSession.seed),
      pinTestProfiles: finderIncludesRegisteredTestProfiles(),
      getRequestCount: (card) =>
        card.kind === "manual" ? (card.row as ManualFinderRow).monthlyRequestCount : 0,
    },
  ) as FinderCard[];

  const visibleCards = orderedCards.slice(0, visibleLimit);
  // With a panel filter on, every listing was loaded (hasListFilter), so the cards are the count.
  const totalResultsCount =
    panelRegisteredCount + (manualCardTotalCount ?? panelCards.length - panelRegisteredCount);
  const hasMoreResults = hasMoreFinderResults({
    totalCount: totalResultsCount,
    visibleCount: visibleCards.length,
    resultsPage,
    hasListFilter,
  });
  /** Each registered professional on screen once, for the per-page loads. */
  const visibleRegisteredIds = Array.from(
    new Set(
      visibleCards.filter((card) => card.kind === "registered").map((card) => card.professionalId),
    ),
  );

  // The note on each registered card on screen (3+ published reviews): one small read,
  // only for these cards. Read only; the reviews are written by the patient's emailed link.
  const registeredRatings = supabase
    ? await loadPublishedRatings(
        supabase,
        visibleRegisteredIds,
      )
    : new Map<string, FinderRating>();

  const registeredAvailabilityKey = finderAvailabilityRequestKey(visibleRegisteredIds);
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
  // Each professional once, however many of her clinics are on screen.
  const schemaCards = visibleCards.filter(
    (card, index) =>
      visibleCards.findIndex((c) => c.professionalId === card.professionalId) === index,
  );
  const schemaEntries = schemaCards.map((item) => {
    if (item.kind === "registered") {
      const row = item.row;
      const profileUrl = row.slug ? `${siteUrl}/${row.slug}` : null;
      return {
        name: row.displayName,
        specialty: row.specialty ?? "General Practice",
        district: (item.place?.district ?? row.district ?? activeDistrict) || null,
        profileUrl,
        mapsUrl: null,
      };
    }

    const row = item.row;
    const place = row.locations.find((loc) => loc.clinicId === item.place?.clinicId) ?? null;
    return {
      name: row.displayName,
      specialty: row.specialty,
      district: place?.district ?? null,
      profileUrl: null,
      mapsUrl: place?.addressMapsLink ?? "",
    };
  });

  const scheme = await getSiteScheme();

  return (
    <main className="min-h-screen bg-site-ink-50 text-site-ink-800">
      <FinderShuffleSeedCookie seed={shuffleSession.seed} persist={shuffleSession.persist} />
      <FinderStructuredData
        siteUrl={siteUrl}
        finderPath={finderPath}
        entries={schemaEntries}
        activeDistrict={activeDistrict}
        activeSpecialty={activeSpecialty}
      />
      {/* G's intro line, above the header and its search (user, 2026-10-16: new wording to come). */}
      <div data-testid="finder-intro" className="bg-site-clinical-100">
        <p className="mx-auto max-w-7xl px-4 py-2.5 text-sm text-site-ink-800 sm:px-6 lg:px-8">
          <strong className="font-semibold text-site-ink-900">
            Every doctor and clinic in Cyprus, GeSY and private.
          </strong>{" "}
          Book online with the ones who take bookings, call the rest.
        </p>
      </div>
      <FinderPublicHeader
        proSessionHint={isProSessionHintValue(
          cookies().get(PRO_SESSION_HINT_COOKIE)?.value,
        )}
        scheme={scheme}
        search={
          <FinderHeaderSearch
            districts={districts}
            activeDistrict={activeDistrict}
            activeSpecialty={activeSpecialty}
            activeName={activeName}
            activeTown={activeTown}
            activeLatitude={userCoords?.latitude ?? null}
            activeLongitude={userCoords?.longitude ?? null}
            specialtyOptions={finderSpecialtyOptions}
          />
        }
      />

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight text-site-ink-900 sm:text-[28px]">
              {finderH1}
            </h1>
            <FinderResultsCount
              count={totalResultsCount}
              hasActiveFilters={hasActiveFilters}
              variant="heading"
            />
          </div>
          {hasActiveFilters ? (
            <span data-testid="finder-clear-search">
              <PendingLink
                href="/"
                navigationReason="finder-results"
                className="text-sm font-semibold text-site-clinical-800 underline decoration-site-clinical-300 underline-offset-4 hover:decoration-current"
              >
                Clear search
              </PendingLink>
            </span>
          ) : null}
        </div>
        {activeDistrict === "Paphos" ? (
          <p role="note" className="mt-3 text-sm text-site-ink-700">
            Looking for urgent care in Paphos?{" "}
            <PendingLink
              href="/blog/emergency-room-paphos-gesy-faster-options"
              className="font-semibold text-site-clinical-800 underline underline-offset-[3px]"
            >
              Read our guide on GESY specialists &amp; private hospitals
            </PendingLink>
          </p>
        ) : null}
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <FinderRecentlyViewed kind="professional" />
        <FinderResultsTransition>
          {dataWarning ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {dataWarning}
            </div>
          ) : null}

          {/* Finder G, step 3: the filter panel opens once a search is on. */}
          <FinderFilterPanel
            show={hasListFilter}
            activeName={activeName}
            filters={panelFilters}
            serverFilterKey={finderPanelFilterKey(panelFilters, activeName)}
          >
          <section className="mt-6">
            <FinderResultsAvailabilityShell dayHeaders={finderAvailabilityDayHeaders}>
              <div className="flex flex-col gap-4">
                {visibleCards.map((item, index) => {
                const imagePriority = finderCardImagePriority(index);
                if (item.kind === "registered") {
                  const row = item.row;
                  const showRightColumn = Boolean(row.slug);
                  const cardLocation =
                    row.locations.find((loc) => loc.id === item.place?.linkId) ?? null;
                  const cardAddress = cardLocation?.clinic_address ?? row.clinic_address;
                  return (
                    <article
                      key={item.key}
                      className={`flex flex-col gap-4 ${finderResultCardClass}`}
                    >
                      <div className={finderRegisteredCardRowClass}>
                      <div
                        className={`flex min-w-0 shrink-0 flex-col gap-3 ${finderRegisteredIdentityColumnClass} ${finderCardIdentityMinHeightClass}`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          {row.slug ? (
                          <PendingLink
                            href={publicProfessionalProfilePath(row.slug)}
                            navigationReason="profile"
                            fill
                            prefetch={false}
                            aria-label={`View ${row.displayName} booking page`}
                            className="group h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-site-clinical-200 bg-site-clinical-50 ring-2 ring-clinical-100 transition-none hover:border-site-clinical-300 hover:ring-clinical-200"
                          >
                            {row.avatarUrl ? (
                              <img
                                src={row.avatarUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                {...imagePriority}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-site-clinical-700">
                                {getInitials(row.displayName)}
                              </div>
                            )}
                          </PendingLink>
                        ) : (
                          <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-site-clinical-200 bg-site-clinical-50 ring-2 ring-clinical-100">
                            {row.avatarUrl ? (
                              <img
                                src={row.avatarUrl}
                                alt={`${row.displayName} profile photo`}
                                className="h-full w-full object-cover"
                                {...imagePriority}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-site-clinical-700">
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
                              className="text-left text-[17px] font-bold leading-[1.2] tracking-tight text-site-ink-900 transition-none hover:text-site-clinical-600"
                            >
                              <span className="line-clamp-2">{row.displayName}</span>
                            </PendingLink>
                          ) : (
                            <p className="line-clamp-2 text-[17px] font-bold leading-[1.2] tracking-tight text-site-ink-900">
                              {row.displayName}
                            </p>
                          )}
                          <FinderSpecialtyPills
                            specialties={row.specialties}
                            specialty={row.specialty ?? "Specialty not set"}
                            className="-ml-2"
                          />
                          {row.isGesy || registeredRatings.get(row.id) ? (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {row.isGesy ? <GesyProviderBadge size="xs" language="en" /> : null}
                              {registeredRatings.get(row.id) ? (
                                <FinderCardRating rating={registeredRatings.get(row.id)!} />
                              ) : null}
                            </div>
                          ) : null}
                          {item.distanceKm !== null ? (
                            <p className="text-xs font-semibold text-site-clinical-700">
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
                              locationId={item.place?.linkId ?? null}
                              clinicAddress={cardAddress}
                            />
                          </Suspense>
                        ) : (
                          <div>
                            <p className="text-xs leading-relaxed text-site-ink-600 whitespace-pre-wrap break-words">
                              {cardAddress?.trim() ? cardAddress.trim() : "Not provided yet"}
                            </p>
                            <FinderRegisteredPublicCall
                              doctorId={row.id}
                              doctorIdsKey={registeredAvailabilityKey}
                            />
                          </div>
                        )}
                      </div>
                      </div>
                      {/* The listing cards' footer height, so every card is the same size. */}
                      <div aria-hidden className={finderCardFooterHeightClass} />
                    </article>
                  );
                }

                const row = item.row;
                const manualLandingHref = row.slug
                  ? publicProfessionalProfilePath(row.slug)
                  : null;
                const manualPlace =
                  row.locations.find((loc) => loc.clinicId === item.place?.clinicId) ?? null;
                const manualClinic =
                  manualPlace?.name && manualPlace.slug
                    ? {
                        id: manualPlace.clinicId,
                        name: manualPlace.name,
                        slug: manualPlace.slug,
                        address: manualPlace.address,
                        addressMapsLink: manualPlace.addressMapsLink,
                        district: manualPlace.district,
                        hasPhone: manualPlace.hasPhone,
                      }
                    : null;
                const manualDistrict = manualPlace?.district ?? "";
                return (
                  <article
                    key={item.key}
                    className={`flex flex-col gap-4 ${finderResultCardClass}`}
                  >
                    <div className={finderRegisteredCardRowClass}>
                      <div
                        className={`flex min-w-0 shrink-0 flex-col gap-3 ${finderRegisteredIdentityColumnClass} ${finderCardIdentityMinHeightClass}`}
                      >
                      <div className="flex min-w-0 items-start gap-3">
                      {manualLandingHref ? (
                        <PendingLink
                          href={manualLandingHref}
                          navigationReason="profile"
                          fill
                          prefetch={false}
                          aria-label={`View ${row.displayName} directory profile`}
                        className={`group h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border bg-site-ink-50 ring-2 transition-none hover:border-site-clinical-300 hover:ring-clinical-200 border-site-clinical-200 ring-clinical-100`}
                        >
                          <img
                            src={row.photoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            {...imagePriority}
                          />
                        </PendingLink>
                      ) : (
                        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-site-clinical-200 bg-site-ink-50 ring-2 ring-clinical-100">
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
                            className="text-left text-[17px] font-bold leading-[1.2] tracking-tight text-site-ink-900 transition-none hover:text-site-clinical-600"
                          >
                            <span className="line-clamp-2">{row.displayName}</span>
                          </PendingLink>
                        ) : (
                          <p className="line-clamp-2 text-[17px] font-bold leading-[1.2] tracking-tight text-site-ink-900">
                            {row.displayName}
                          </p>
                        )}
                        <FinderSpecialtyPills
                          specialties={row.specialties}
                          specialty={row.specialty}
                          district={manualDistrict}
                          className="-ml-2"
                        />
                        {row.isGesy ? (
                          <div className="self-start">
                            <GesyProviderBadge size="xs" language="en" />
                          </div>
                        ) : null}
                        {item.distanceKm !== null ? (
                          <p className="text-xs font-semibold text-site-clinical-700">
                            {nearMeApproximate
                              ? formatApproxDistanceAway(item.distanceKm)
                              : formatDistanceAway(item.distanceKm)}
                          </p>
                        ) : null}
                      </div>
                      </div>
                    </div>

                    <div className={finderRegisteredDetailsSectionClass}>
                      <FinderManualLocationCalendars
                        listing={{
                          id: row.id,
                          district: manualDistrict,
                          address: manualPlace?.address ?? null,
                          address_maps_link: manualPlace?.addressMapsLink ?? null,
                          clinic: manualClinic,
                          clinics: manualClinic ? [manualClinic] : [],
                          monthlyRequestCount: row.monthlyRequestCount,
                        }}
                        previewSeedKey={
                          row.locations.length > 1 && manualPlace
                            ? manualPreviewSeedKey(row.id, manualPlace.clinicId)
                            : null
                        }
                        dayHeaders={finderAvailabilityDayHeaders}
                        callToBookSource="finder_card"
                      />
                    </div>
                    </div>

                    <div
                      className={`${finderCardManualFooterClass} ${finderCardManualFooterActionsClass} ${finderCardFooterHeightClass}`}
                    >
                      <ManualDirectoryDoctorClaimFooter professionalId={row.id} />
                      <ManualDirectoryReportIncorrectInfoLink
                        displayName={row.displayName}
                        specialty={row.specialty}
                        district={manualDistrict}
                      />
                    </div>
                  </article>
                );
              })}
              {orderedCards.length === 0 ? (
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
          </FinderFilterPanel>

          <footer className="mt-12 border-t border-site-ink-200 pt-6 pb-2">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <section className="w-full">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-site-ink-400">
                  Popular Healthcare Searches in Cyprus
                </h2>

                <details className="mt-3 rounded-xl border border-site-ink-200 bg-site-white p-3 md:hidden">
                  <summary className="cursor-pointer text-sm font-semibold text-site-ink-800">
                    Explore by city and specialty
                  </summary>
                  <div className="mt-3 grid gap-4">
                    {SEO_CITIES.map((city) => (
                      <section key={`mobile-${city}`}>
                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-site-clinical-600">
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
                <p className="text-xs text-site-ink-500">
                  Are you a healthcare professional?{" "}
                  <PendingLink
                    href="/register"
                    className="font-semibold text-site-clinical-600 underline underline-offset-4 transition hover:text-site-clinical-500"
                  >
                    List your practice
                  </PendingLink>
                  .
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <PendingLink
                    href="/terms"
                    className="text-xs font-semibold text-site-ink-500 underline underline-offset-4 transition hover:text-site-clinical-600"
                  >
                    Terms of Use
                  </PendingLink>
                  <PendingLink
                    href="/privacy"
                    className="text-xs font-semibold text-site-ink-500 underline underline-offset-4 transition hover:text-site-clinical-600"
                  >
                    Privacy
                  </PendingLink>
                  <a
                    href="https://www.instagram.com/doccy_cyprus?igsh=MW94Zjg1czZ6OXNzaw=="
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-site-ink-200 bg-site-white text-site-ink-500 transition hover:border-site-clinical-300 hover:text-site-clinical-600"
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

