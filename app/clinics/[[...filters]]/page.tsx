import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { ClinicLandingView } from "@/components/finder/ClinicLandingView";
import { ClinicsFilters } from "@/components/finder/ClinicsFilters";
import { FinderAudienceToggle } from "@/components/finder/FinderAudienceToggle";
import { FinderHeroSection } from "@/components/finder/FinderHeroSection";
import { FinderRecentlyViewed } from "@/components/finder/FinderRecentlyViewed";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import { FinderResultsTransition } from "@/components/finder/FinderResultsTransition";
import { FinderSearchBar } from "@/components/finder/FinderSearchBar";
import { finderResultCardClass, finderSoftButtonClass } from "@/components/finder/finder-surface";
import { MarketingFooter } from "@/components/navigation/MarketingFooter";
import { PendingLink } from "@/components/navigation/PendingLink";
import { clinicLandingPath } from "@/lib/clinic-landing-path";
import { CLINICS_SEARCH_BASE, clinicsResultsPath } from "@/lib/clinics-public-path";
import { buildClinicsResultsHeading } from "@/lib/finder-results-heading";
import {
  FINDER_RESULTS_MAX_PAGE_FILTERED,
  FINDER_RESULTS_MAX_PAGE_UNFILTERED,
  FINDER_RESULTS_PAGE_SIZE,
  buildFinderResultsPageHref,
  escapeIlikePattern,
  parseFinderResultsPage,
} from "@/lib/finder-results-paging";
import { CYPRUS_DISTRICTS, type CyprusDistrict, isCyprusDistrict } from "@/lib/cyprus-districts";
import {
  reconcileFinderTownAndDistrict,
  resolveFinderTownQuery,
  townToSlug,
} from "@/lib/cyprus-towns";
import { FINDER_CLINIC_HERO_ILLUSTRATION, resolveClinicDisplayPhotoUrl } from "@/lib/finder-default-avatars";
import { FINDER_CLINICS_HERO_SRC } from "@/lib/finder-hero-images";
import { finderCardImagePriority } from "@/lib/finder-card-image-priority";
import {
  computeFinderDistanceKm,
  formatDistanceAway,
  parseOptionalCoordinates,
  type Coordinates,
} from "@/lib/finder-distance";
import { isAllSlug, slugToDistrict, toTitleCaseWords } from "@/lib/finder-seo";
import { loadClinicBySlug } from "@/lib/load-clinic-by-slug";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  fetchAllSupabaseRows,
  fetchAllSupabaseRowsForIdChunks,
} from "@/lib/supabase-fetch-all";
import { getCachedDirectoryPayload } from "@/lib/finder-directory-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClinicsPageProps = {
  params: {
    filters?: string[];
  };
  searchParams?: {
    name?: string;
    town?: string;
    lat?: string;
    lon?: string;
    page?: string;
  };
};

type ClinicSearchRow = {
  id: string;
  name: string;
  slug: string;
  district: CyprusDistrict;
  address: string | null;
  hasPhone: boolean;
  address_maps_link: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string;
  professionalCount: number;
  distanceKm: number | null;
};

function normalizeSelectValue(value: string | undefined): string {
  return String(value ?? "").trim();
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
  districtQueryParam?: string,
): string {
  const segment = normalizeSelectValue(decodeSegment(districtSegment));
  if (segment) {
    if (isAllSlug(segment)) return "";
    const bySlug = slugToDistrict(segment);
    if (bySlug) return bySlug;
    if (isCyprusDistrict(segment)) return segment;
  }

  const queryValue = normalizeSelectValue(districtQueryParam);
  if (!queryValue || isAllSlug(queryValue)) return "";
  if (isCyprusDistrict(queryValue)) return queryValue;
  return slugToDistrict(queryValue) ?? "";
}

function parseUserCoordinates(searchParams: ClinicsPageProps["searchParams"]): Coordinates | null {
  const latRaw = String(searchParams?.lat ?? "").trim();
  const lonRaw = String(searchParams?.lon ?? "").trim();
  if (!latRaw || !lonRaw) return null;
  return parseOptionalCoordinates(Number(latRaw), Number(lonRaw));
}

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com").replace(
    /\/+$/,
    "",
  );
}

/** `/clinics/paphos` = district search; `/clinics/paphos-demo-clinic` = clinic profile. */
function isClinicProfileSegment(segment: string): boolean {
  return Boolean(segment) && !resolveDistrictValue(segment);
}

export async function generateMetadata({ params }: ClinicsPageProps): Promise<Metadata> {
  const filters = params.filters ?? [];
  if (filters.length > 1) {
    return { title: "Not found | DocCy", robots: { index: false, follow: false } };
  }

  const segment = normalizeSelectValue(decodeSegment(filters[0]));
  if (segment && isClinicProfileSegment(segment)) {
    const supabase = createServiceRoleClient();
    if (!supabase) return { title: "Clinic | DocCy" };
    const clinic = await loadClinicBySlug(supabase, segment);
    if (!clinic) {
      return { title: "Clinic not found | DocCy", robots: { index: false, follow: false } };
    }
    const pageUrl = `${siteBaseUrl()}${clinicLandingPath(clinic.slug)}`;
    const title = `${clinic.name} | ${clinic.district}, Cyprus | DocCy`;
    const description = `Healthcare professionals practicing at ${clinic.name} in ${clinic.district}, Cyprus. View profiles and request appointments on DocCy.`;
    const ogImage = `${siteBaseUrl()}${FINDER_CLINIC_HERO_ILLUSTRATION}`;
    return {
      title,
      description,
      alternates: { canonical: pageUrl },
      openGraph: {
        title,
        description,
        type: "website",
        url: pageUrl,
        images: [{ url: ogImage }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  }

  const district = resolveDistrictValue(segment || undefined);
  const districtLabel = district ? toTitleCaseWords(district) : "";

  if (districtLabel) {
    return {
      title: `Clinics in ${districtLabel}, Cyprus | DocCy`,
      description: `Find healthcare clinics in ${districtLabel}, Cyprus. Browse locations and professionals on DocCy.`,
    };
  }

  return {
    title: "Find Clinics in Cyprus | DocCy",
    description:
      "Search healthcare clinics across Cyprus by name, district, or near you. Open a clinic to see professionals on DocCy.",
  };
}

export default async function ClinicsPage({ params, searchParams }: ClinicsPageProps) {
  const filters = params.filters ?? [];
  if (filters.length > 1) notFound();

  const segment = normalizeSelectValue(decodeSegment(filters[0]));
  if (segment && isClinicProfileSegment(segment)) {
    const supabase = createServiceRoleClient();
    if (!supabase) notFound();
    const clinic = await loadClinicBySlug(supabase, segment);
    if (!clinic) notFound();
    return <ClinicLandingView clinic={clinic} />;
  }

  return ClinicsSearchPage({ params, searchParams });
}

async function ClinicsSearchPage({ params, searchParams }: ClinicsPageProps) {
  const supabase = createServiceRoleClient();
  const requestedTown = resolveFinderTownQuery(searchParams?.town);
  const reconciled = reconcileFinderTownAndDistrict({
    town: requestedTown,
    district: resolveDistrictValue(params.filters?.[0]),
  });
  const activeDistrict = reconciled.district;
  const activeTown = reconciled.town;
  const activeName = normalizeSelectValue(searchParams?.name);
  const userCoords = parseUserCoordinates(searchParams);
  const districts = CYPRUS_DISTRICTS;
  const hasActiveFilters = Boolean(activeDistrict || activeName || activeTown || userCoords);
  const hasListFilter = hasActiveFilters;
  const resultsPage = parseFinderResultsPage(searchParams?.page, { hasListFilter });
  const maxResultsPage = hasListFilter
    ? FINDER_RESULTS_MAX_PAGE_FILTERED
    : FINDER_RESULTS_MAX_PAGE_UNFILTERED;
  const districtLabel = activeDistrict ? toTitleCaseWords(activeDistrict) : "";
  const placeLabel = activeTown || districtLabel;
  const townHint =
    activeTown && activeDistrict && activeTown === activeDistrict
      ? `${activeTown} (town)`
      : activeTown || null;

  const visibleLimit = resultsPage * FINDER_RESULTS_PAGE_SIZE;
  /** Bounded by max page × page size (600) — under PostgREST max-rows. */
  const pagedClinicCap = Math.min(
    visibleLimit,
    maxResultsPage * FINDER_RESULTS_PAGE_SIZE,
  );

  let clinics: ClinicSearchRow[] = [];
  let matchingClinicCount = 0;
  let dataWarning: string | null = null;

  const mapClinicRows = (
    rows: Array<{
      id: string;
      name: string;
      slug: string;
      district: CyprusDistrict;
      address?: string | null;
      phone?: string | null;
      address_maps_link?: string | null;
      latitude?: unknown;
      longitude?: unknown;
    }>,
  ): ClinicSearchRow[] =>
    rows
      .map((row) => {
        const coords = parseOptionalCoordinates(row.latitude, row.longitude);
        const distanceKm = computeFinderDistanceKm(
          userCoords,
          row.latitude,
          row.longitude,
        );
        return {
          id: String(row.id),
          name: String(row.name ?? "Clinic").trim() || "Clinic",
          slug: String(row.slug ?? "").trim(),
          district: row.district,
          address: String(row.address ?? "").trim() || null,
          hasPhone: Boolean(String(row.phone ?? "").trim()),
          address_maps_link: String(row.address_maps_link ?? "").trim() || null,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          photoUrl: resolveClinicDisplayPhotoUrl(null),
          professionalCount: 0,
          distanceKm,
        };
      })
      .filter((row) => Boolean(row.slug));

  const applyClinicListFilters = (query: any) => {
    let next = query.eq("is_archived", false);
    if (activeDistrict && isCyprusDistrict(activeDistrict)) {
      next = next.eq("district", activeDistrict);
    }
    if (activeTown) {
      next = next.eq("town", activeTown);
    }
    if (activeName) {
      next = next.ilike("name", `%${escapeIlikePattern(activeName)}%`);
    }
    return next;
  };

  if (!supabase) {
    dataWarning = "Clinic search is temporarily unavailable.";
  } else if (userCoords) {
    try {
      const data = await getCachedDirectoryPayload(
        ["clinics-all", activeDistrict, activeName, activeTown],
        async () => {
          const { data, error } = await fetchAllSupabaseRows(() =>
            applyClinicListFilters(
              supabase
                .from("clinics")
                .select("id, name, slug, district, address, phone, address_maps_link, latitude, longitude")
                .order("name", { ascending: true }),
            ),
          );
          if (error) throw new Error(error.message ?? "clinics_load_failed");
          return data ?? [];
        },
      );
      clinics = mapClinicRows(data as Parameters<typeof mapClinicRows>[0]);
      clinics.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) {
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
      matchingClinicCount = clinics.length;
    } catch {
      dataWarning = "We could not load clinics right now. Please try again.";
    }
  } else {
    const listSelect =
      "id, name, slug, district, address, phone, address_maps_link, latitude, longitude";
    try {
      const cached = await getCachedDirectoryPayload(
        ["clinics-page", activeDistrict, activeName, activeTown, String(pagedClinicCap)],
        async () => {
          const [countRes, pageRes] = await Promise.all([
            applyClinicListFilters(
              supabase.from("clinics").select("id", { count: "exact", head: true }),
            ),
            applyClinicListFilters(
              supabase
                .from("clinics")
                .select(listSelect)
                .order("name", { ascending: true }),
            ).range(0, pagedClinicCap - 1),
          ]);
          if (countRes.error || pageRes.error) {
            throw new Error(
              countRes.error?.message ?? pageRes.error?.message ?? "clinics_load_failed",
            );
          }
          return {
            count: countRes.count ?? (pageRes.data ?? []).length,
            rows: pageRes.data ?? [],
          };
        },
      );
      clinics = mapClinicRows(cached.rows as Parameters<typeof mapClinicRows>[0]);
      matchingClinicCount = cached.count;
    } catch {
      dataWarning = "We could not load clinics right now. Please try again.";
    }
  }

  const visibleClinics = clinics.slice(0, visibleLimit);
  const hasMoreResults =
    matchingClinicCount > visibleClinics.length && resultsPage < maxResultsPage;

  if (supabase && visibleClinics.length > 0) {
    const visibleClinicIds = visibleClinics.map((clinic) => clinic.id);
    const professionalIdsByClinic = new Map<string, Set<string>>();

    const addProfessional = (clinicId: string, professionalId: string) => {
      if (!clinicId || !professionalId) return;
      let set = professionalIdsByClinic.get(clinicId);
      if (!set) {
        set = new Set();
        professionalIdsByClinic.set(clinicId, set);
      }
      set.add(professionalId);
    };

    const [linksRes, legacyRes] = await Promise.all([
      fetchAllSupabaseRowsForIdChunks<{
        clinic_id: string;
        directory_manual_id: string;
      }>(visibleClinicIds, (chunk) =>
        supabase
          .from("directory_manual_clinics")
          .select("clinic_id, directory_manual_id")
          .in("clinic_id", chunk),
      ),
      fetchAllSupabaseRowsForIdChunks<{
        id: string;
        clinic_id: string | null;
      }>(visibleClinicIds, (chunk) =>
        supabase
          .from("directory_manual")
          .select("id, clinic_id")
          .eq("is_archived", false)
          .in("clinic_id", chunk),
      ),
    ]);

    if (!linksRes.error && linksRes.data?.length) {
      const linkedProfessionalIds = Array.from(
        new Set(
          linksRes.data
            .map((row) => String(row.directory_manual_id ?? "").trim())
            .filter(Boolean),
        ),
      );
      const activeProfessionalIds = new Set<string>();

      if (linkedProfessionalIds.length > 0) {
        const activeRes = await fetchAllSupabaseRowsForIdChunks<{ id: string }>(
          linkedProfessionalIds,
          (chunk) =>
            supabase
              .from("directory_manual")
              .select("id")
              .eq("is_archived", false)
              .in("id", chunk),
        );
        if (!activeRes.error && activeRes.data?.length) {
          for (const row of activeRes.data) {
            const id = String(row.id ?? "").trim();
            if (id) activeProfessionalIds.add(id);
          }
        }
      }

      for (const row of linksRes.data) {
        const clinicId = String(row.clinic_id ?? "").trim();
        const professionalId = String(row.directory_manual_id ?? "").trim();
        if (!activeProfessionalIds.has(professionalId)) continue;
        addProfessional(clinicId, professionalId);
      }
    }

    if (!legacyRes.error && legacyRes.data?.length) {
      for (const row of legacyRes.data) {
        const clinicId = String(row.clinic_id ?? "").trim();
        const professionalId = String(row.id ?? "").trim();
        addProfessional(clinicId, professionalId);
      }
    }

    for (const clinic of visibleClinics) {
      clinic.professionalCount = professionalIdsByClinic.get(clinic.id)?.size ?? 0;
    }
  }

  const loadMoreHref = buildFinderResultsPageHref({
    finderPath: clinicsResultsPath(activeDistrict || null),
    name: activeName || undefined,
    town: activeTown ? townToSlug(activeTown) : undefined,
    lat: searchParams?.lat ?? null,
    lon: searchParams?.lon ?? null,
    page: resultsPage + 1,
  });

  const title = buildClinicsResultsHeading({
    districtLabel: placeLabel || null,
  });
  const showClinicsHero = !hasActiveFilters;

  return (
    <main className="min-h-screen bg-ink-50 text-ink-800">
      <header className="px-4 pt-8 pb-8 sm:px-6 sm:pb-0 lg:px-8">
        <PendingLink href="/" className="inline-flex transition hover:opacity-90">
          <DocCyWordmark variant="light" size="xl" />
        </PendingLink>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FinderHeroSection
          title={title}
          showHeroImage={showClinicsHero}
          heroImageSrc={FINDER_CLINICS_HERO_SRC}
          subtitleClassName={
            showClinicsHero
              ? "mt-3 max-w-2xl text-lg leading-relaxed text-ink-600 sm:text-xl"
              : "mt-3 max-w-2xl text-base leading-relaxed text-ink-600 sm:text-lg"
          }
          subtitle={
            placeLabel ? (
              <>Browse healthcare clinics in {placeLabel} and open a clinic to see professionals.</>
            ) : (
              <>
                Search by clinic name or district, or find a clinic near you.{" "}
                <span className="font-medium text-clinical-600">
                  Looking for a specific professional? Switch to Professionals below.
                </span>
              </>
            )
          }
        />
      </div>

      <FinderSearchBar
        className={
          showClinicsHero
            ? "relative z-20 mt-2 sm:-mt-10 lg:-mt-16"
            : "mt-1"
        }
      >
        <FinderAudienceToggle active="clinics" variant="bar" className="mb-5" />
        <ClinicsFilters
          districts={districts}
          activeDistrict={activeDistrict}
          activeName={activeName}
          activeTown={activeTown}
          activeLatitude={userCoords?.latitude ?? null}
          activeLongitude={userCoords?.longitude ?? null}
        />
        {matchingClinicCount > 0 ? (
          <p
            data-testid="clinics-results-count"
            className="mt-3 text-xs leading-relaxed text-white/75"
            aria-live="polite"
          >
            {hasActiveFilters ? (
              <>
                Showing{" "}
                <span className="font-medium tabular-nums text-white">{matchingClinicCount}</span>{" "}
                {matchingClinicCount === 1 ? "clinic" : "clinics"}
                {districtLabel || townHint || activeName ? (
                  <span className="text-white/65">
                    {" "}
                    ·{" "}
                    <span className="text-white/85">
                      {[
                        districtLabel || null,
                        townHint,
                        activeName ? `“${activeName}”` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span className="font-medium tabular-nums text-white">{matchingClinicCount}</span>{" "}
                clinics on DocCy across Cyprus
              </>
            )}
          </p>
        ) : null}
      </FinderSearchBar>

      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <FinderRecentlyViewed kind="clinic" />
        {dataWarning ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {dataWarning}
          </div>
        ) : null}

        <FinderResultsTransition>
          <section className="mt-6">
            {matchingClinicCount === 0 && !dataWarning ? (
              <div className="rounded-2xl border border-dashed border-clinical-200 bg-white px-5 py-10 text-center">
                <p className="text-base font-semibold text-ink-800">No clinics matched these filters</p>
                <p className="mt-2 text-sm text-ink-500">
                  Try another district, town, or name, or{" "}
                  <PendingLink
                    href={CLINICS_SEARCH_BASE}
                    className="font-medium text-clinical-600 underline underline-offset-4"
                  >
                    clear clinic search
                  </PendingLink>
                  .
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {visibleClinics.map((clinic, index) => {
                  const imagePriority = finderCardImagePriority(index);
                  const href = clinicLandingPath(clinic.slug);
                  const mapsHref = clinic.address_maps_link;
                  const hasPhone = clinic.hasPhone;
                  const distanceLabel =
                    clinic.distanceKm !== null ? formatDistanceAway(clinic.distanceKm) : null;
                  const professionalLabel =
                    clinic.professionalCount === 1
                      ? "1 professional works here"
                      : `${clinic.professionalCount} professionals work here`;

                  return (
                    <article
                      key={clinic.id}
                      className={finderResultCardClass}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <PendingLink
                          href={href}
                          navigationReason="profile"
                          fill
                          prefetch={false}
                          aria-label={`View ${clinic.name}`}
                          className="group h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-clinical-50 ring-2 ring-clinical-100 transition-none hover:border-clinical-300 hover:ring-clinical-200"
                        >
                          <img
                            src={clinic.photoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            {...imagePriority}
                          />
                        </PendingLink>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h2 className="text-lg font-semibold tracking-tight text-ink-900">
                                <PendingLink
                                  href={href}
                                  navigationReason="profile"
                                  prefetch={false}
                                  className="transition hover:text-clinical-700"
                                >
                                  {clinic.name}
                                </PendingLink>
                              </h2>
                              <p className="mt-1 text-sm text-ink-600">
                                Clinic · {clinic.district}, Cyprus
                                {distanceLabel ? (
                                  <span className="text-ink-500"> · {distanceLabel}</span>
                                ) : null}
                              </p>
                            </div>
                            <PendingLink
                              href={clinicsResultsPath(clinic.district)}
                              className="inline-flex rounded-full border border-clinical-200 bg-clinical-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-clinical-800 transition hover:bg-clinical-100"
                            >
                              {clinic.district}
                            </PendingLink>
                          </div>

                          {clinic.address ? (
                            <p className="mt-2 text-sm leading-relaxed text-ink-600">{clinic.address}</p>
                          ) : null}

                          <p className="mt-2 text-xs font-medium text-ink-500">{professionalLabel}</p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {mapsHref ? (
                              <a
                                href={mapsHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-full border border-clinical-200 bg-white px-3 py-1.5 text-xs font-semibold text-clinical-700 transition hover:border-clinical-300 hover:bg-clinical-50"
                              >
                                Open in Maps ↗
                              </a>
                            ) : null}
                            <RevealPhoneButton
                              kind="clinic"
                              id={clinic.id}
                              hasPhone={hasPhone}
                              className="inline-flex items-center rounded-full border border-clinical-200 bg-white px-3 py-1.5 text-xs font-semibold text-clinical-700 transition hover:border-clinical-300 hover:bg-clinical-50 disabled:cursor-wait disabled:opacity-60"
                              revealedClassName="inline-flex items-center rounded-full border border-clinical-200 bg-clinical-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-clinical-800"
                            />
                            <PendingLink
                              href={href}
                              navigationReason="profile"
                              prefetch={false}
                              className="inline-flex items-center rounded-full bg-clinical-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-clinical-400"
                            >
                              View clinic
                            </PendingLink>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {hasMoreResults ? (
                  <div className="flex justify-center pt-2">
                    <PendingLink href={loadMoreHref} className={finderSoftButtonClass}>
                      Show more clinics
                    </PendingLink>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </FinderResultsTransition>

        <MarketingFooter variant="light" className="mx-auto mt-10 w-full max-w-7xl pb-24 pt-2 sm:pb-16 lg:pb-12" />
      </div>
    </main>
  );
}
