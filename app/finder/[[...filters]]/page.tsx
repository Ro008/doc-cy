import type { Metadata } from "next";
import { PendingLink } from "@/components/navigation/PendingLink";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { CYPRUS_DISTRICTS, type CyprusDistrict, isCyprusDistrict } from "@/lib/cyprus-districts";
import { languageThemeForLabel } from "@/lib/cyprus-languages";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { FinderFilters } from "@/components/finder/FinderFilters";
import { FinderResultsTransition } from "@/components/finder/FinderResultsTransition";
import { FinderStructuredData } from "@/components/finder/FinderStructuredData";
import { FinderFaqSection } from "@/components/finder/FinderFaqSection";
import {
  districtToSlug,
  isAllSlug,
  slugToDistrict,
  slugToSpecialty,
  specialtyToSlug,
  toTitleCaseWords,
} from "@/lib/finder-seo";

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
  };
};

type RegisteredFinderRow = {
  id: string;
  name: string;
  specialty: string | null;
  district: string | null;
  slug: string | null;
  languages: string[];
  avatarUrl: string | null;
  isTestProfile: boolean;
};

type ManualFinderRow = {
  id: string;
  name: string;
  specialty: string;
  district: CyprusDistrict;
  address_maps_link: string;
};

const TEST_NAME_MARKER = /\btest\b/i;

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

function isTestProfileLike(row: {
  name: string;
  isTestProfile?: boolean | null;
}): boolean {
  if (row.isTestProfile === true) return true;
  return TEST_NAME_MARKER.test(row.name);
}

function normalizeSpecialtyTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bdentistry\b/g, "dentist")
    .replace(/\bdental\b/g, "dentist")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDistrictTerm(value: string): string {
  return value.toLowerCase().trim();
}

function matchesSpecialtyFilter(candidate: string, query: string): boolean {
  const normalizedCandidate = normalizeSpecialtyTerm(candidate);
  const normalizedQuery = normalizeSpecialtyTerm(query);
  if (!normalizedQuery) return true;
  return normalizedCandidate.includes(normalizedQuery);
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const districts = CYPRUS_DISTRICTS;

  let registeredRows: RegisteredFinderRow[] = [];
  let manualRows: ManualFinderRow[] = [];
  let dataWarning: string | null = null;

  if (supabase) {
    const registeredSelectAttempts = [
      "id, name, specialty, district, slug, languages, avatar_url, is_test_profile",
      "id, name, specialty, district, slug, languages, avatar_url",
      "id, name, specialty, district, slug, languages, is_test_profile",
      "id, name, specialty, district, slug, languages",
      "id, name, specialty, district, slug, is_test_profile",
      "id, name, specialty, district, slug",
      "id, name, specialty, slug, is_test_profile",
      "id, name, specialty, slug",
    ];

    for (const selectClause of registeredSelectAttempts) {
      const result = await supabase
        .from("doctors")
        .select(selectClause)
        .eq("status", "verified")
        .not("slug", "is", null)
        .order("name", { ascending: true })
        .limit(300);

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
            specialty: (raw.specialty as string | null) ?? null,
            district: (raw.district as string | null) ?? null,
            slug: (raw.slug as string | null) ?? null,
            languages: normalizeLanguages(raw.languages),
            avatarUrl: toPublicAvatarUrl(raw.avatar_url),
            isTestProfile: Boolean(raw.is_test_profile ?? false),
          };
        })
        .filter((row) => !isTestProfileLike({ name: row.name, isTestProfile: row.isTestProfile }));
      break;
    }

    const manualRes = await supabase
      .from("directory_manual")
      .select("id, name, specialty, district, address_maps_link")
      .eq("is_archived", false)
      .order("name", { ascending: true })
      .limit(600);

    if (manualRes.error) {
      dataWarning = dataWarning ?? "Could not load manual directory entries.";
    } else {
      manualRows = (manualRes.data ?? []).map((row) => ({
        id: row.id as string,
        name: String(row.name ?? "Professional"),
        specialty: String(row.specialty ?? "Specialty not set"),
        district: row.district as CyprusDistrict,
        address_maps_link: String(row.address_maps_link ?? ""),
      }));
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
    if (activeSpecialty && !matchesSpecialtyFilter(row.specialty ?? "", activeSpecialty)) {
      return false;
    }
    if (activeName && !row.name.toLowerCase().includes(activeName.toLowerCase())) {
      return false;
    }
    return true;
  });

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
    if (activeName && !row.name.toLowerCase().includes(activeName.toLowerCase())) {
      return false;
    }
    return true;
  });

  const unifiedResults = [
    ...filteredRegistered.map((row) => ({ kind: "registered" as const, row })),
    ...filteredManual.map((row) => ({ kind: "manual" as const, row })),
  ];
  const hasActiveFilters = Boolean(activeDistrict || activeSpecialty || activeName);
  const specialtyLabel = activeSpecialty ? toTitleCaseWords(activeSpecialty) : "Health Professionals";
  const districtLabel = activeDistrict ? toTitleCaseWords(activeDistrict) : "Cyprus";
  const hasSpecificFilters = Boolean(activeDistrict && activeSpecialty);
  const finderH1 = hasSpecificFilters
    ? `${specialtyLabel} in ${districtLabel}`
    : "Health Professionals in Cyprus";
  const finderSnippet = hasSpecificFilters
    ? `Find English-speaking ${specialtyLabel} in ${districtLabel}. Compare profiles and Book online with confidence.`
    : "Find English-speaking Health Professionals in Cyprus. Explore specialties, compare districts, and Book online easily.";
  const finderPath =
    activeDistrict && activeSpecialty
      ? `/finder/${districtToSlug(activeDistrict as CyprusDistrict)}/${specialtyToSlug(
          activeSpecialty
        )}`
      : activeDistrict
        ? `/finder/${districtToSlug(activeDistrict as CyprusDistrict)}`
        : "/finder";
  const schemaEntries = unifiedResults.map((item) => {
    if (item.kind === "registered") {
      const row = item.row;
      const profileUrl = row.slug ? `${siteUrl}/${row.slug}` : null;
      return {
        name: row.name,
        specialty: row.specialty ?? "General Practice",
        district: (row.district ?? activeDistrict) || null,
        profileUrl,
        mapsUrl: null,
      };
    }

    const row = item.row;
    return {
      name: row.name,
      specialty: row.specialty,
      district: row.district,
      profileUrl: null,
      mapsUrl: row.address_maps_link,
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <FinderStructuredData
        siteUrl={siteUrl}
        finderPath={finderPath}
        entries={schemaEntries}
        activeDistrict={activeDistrict}
        activeSpecialty={activeSpecialty}
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div>
            <PendingLink
              href="/"
              className="inline-flex transition hover:opacity-90"
            >
              <DocCyWordmark />
            </PendingLink>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">{finderH1}</h1>
            <p className="mt-2 text-sm text-slate-400">{finderSnippet}</p>
          </div>
        </header>

        <section className="rounded-2xl border border-emerald-300/20 bg-slate-900/60 p-4 shadow-[0_0_40px_-18px_rgba(16,185,129,0.4)]">
          <FinderFilters
            districts={districts}
            activeDistrict={activeDistrict}
            activeSpecialty={activeSpecialty}
            activeName={activeName}
          />
        </section>

        <FinderResultsTransition>
          {dataWarning ? (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {dataWarning}
            </div>
          ) : null}

          <section className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {unifiedResults.map((item) => {
                if (item.kind === "registered") {
                  const row = item.row;
                  return (
                    <article
                      key={`registered-${row.id}`}
                      className="flex h-full min-h-[276px] flex-col rounded-2xl border border-emerald-400/20 bg-slate-900/70 p-4 shadow-[0_0_22px_-12px_rgba(52,211,153,0.55)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-emerald-300/35 bg-slate-800 ring-2 ring-emerald-400/10">
                          {row.avatarUrl ? (
                            <img
                              src={row.avatarUrl}
                              alt={`${row.name} profile photo`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-emerald-200">
                              {getInitials(row.name)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[17px] font-bold leading-[1.2] tracking-tight text-slate-50">
                            {row.name}
                          </p>
                          <p className="mt-2 inline-flex max-w-full items-center rounded-full border border-slate-700/80 bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                            <span className="whitespace-normal break-words text-center leading-snug">
                              {row.specialty ?? "Specialty not set"}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {row.district ?? "District pending"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 min-h-[64px]">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
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
                          <p className="text-xs text-slate-500">Not specified</p>
                        )}
                      </div>
                      {row.slug ? (
                        <PendingLink
                          href={`/${row.slug}`}
                          className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                        >
                          Book Online
                        </PendingLink>
                      ) : null}
                    </article>
                  );
                }

                const row = item.row;
                return (
                  <article
                    key={`manual-${row.id}`}
                    className="flex h-full min-h-[276px] flex-col rounded-2xl border border-slate-700 bg-slate-900/65 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-800/80 ring-2 ring-slate-500/10">
                        <span className="text-sm font-semibold text-slate-200">
                          {getInitials(row.name)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[17px] font-bold leading-[1.2] tracking-tight text-slate-50">
                          {row.name}
                        </p>
                        <p className="mt-2 inline-flex max-w-full items-center rounded-full border border-slate-700/80 bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                          <span className="whitespace-normal break-words text-center leading-snug">
                            {row.specialty}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 min-h-[84px]">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Location
                      </p>
                      <p className="mb-1.5 text-xs font-medium text-slate-400">{row.district}</p>
                      <a
                        href={row.address_maps_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-300 hover:text-emerald-200"
                      >
                        Open in Google Maps ↗
                      </a>
                    </div>

                    <p className="mt-auto mb-2 text-center text-xs font-medium tracking-wide text-emerald-200/90">
                      Is this you?
                    </p>
                    <PendingLink
                      href="/#founders-pricing"
                      className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                    >
                      Activate online booking
                    </PendingLink>
                  </article>
                );
              })}
              {unifiedResults.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {hasActiveFilters
                    ? "No professionals match these filters."
                    : "No professionals available right now. Please check back soon."}
                </p>
              ) : null}
            </div>
          </section>

          <footer className="mt-12 border-t border-slate-800/80 pt-6 pb-2">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Find a Professional quick links
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <PendingLink
                    href={`/finder/paphos/${specialtyToSlug("Dentistry")}`}
                    className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-300/50 hover:text-emerald-200"
                  >
                    Dentists in Paphos
                  </PendingLink>
                  <PendingLink
                    href={`/finder/limassol/${specialtyToSlug("Dermatology")}`}
                    className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-300/50 hover:text-emerald-200"
                  >
                    Dermatologists in Limassol
                  </PendingLink>
                </div>
              </section>

              <section className="md:max-w-sm">
                <p className="text-xs text-slate-400">
                  Are you a healthcare professional?{" "}
                  <PendingLink
                    href="/#founders-pricing"
                    className="font-semibold text-emerald-300 underline underline-offset-4 transition hover:text-emerald-200"
                  >
                    List your practice
                  </PendingLink>
                  .
                </p>
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

