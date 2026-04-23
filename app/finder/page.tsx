import { PendingLink } from "@/components/navigation/PendingLink";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { CYPRUS_DISTRICTS, type CyprusDistrict, isCyprusDistrict } from "@/lib/cyprus-districts";
import { languageThemeForLabel } from "@/lib/cyprus-languages";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { FinderFilters } from "@/components/finder/FinderFilters";
import { FinderResultsTransition } from "@/components/finder/FinderResultsTransition";

type FinderPageProps = {
  searchParams?: {
    district?: string;
    specialty?: string;
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
};

type ManualFinderRow = {
  id: string;
  name: string;
  specialty: string;
  district: CyprusDistrict;
  address_maps_link: string;
};

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

export default async function FinderPage({ searchParams }: FinderPageProps) {
  const supabase = createServiceRoleClient();
  const districtParam = normalizeSelectValue(searchParams?.district);
  const specialtyParam = normalizeSelectValue(searchParams?.specialty);
  const activeDistrict = isCyprusDistrict(districtParam) ? districtParam : "";
  const activeSpecialty = specialtyParam;

  const districts = CYPRUS_DISTRICTS;

  let registeredRows: RegisteredFinderRow[] = [];
  let manualRows: ManualFinderRow[] = [];
  let dataWarning: string | null = null;

  if (supabase) {
    const registeredSelectAttempts = [
      "id, name, specialty, district, slug, languages, avatar_url",
      "id, name, specialty, district, slug, languages",
      "id, name, specialty, district, slug",
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
        if (result.error.code === "42703") {
          continue;
        }
        dataWarning = "Could not load registered professionals.";
        break;
      }

      registeredRows = (result.data ?? []).map((row) => {
        const raw = row as Record<string, unknown>;
        return {
          id: String(raw.id ?? ""),
          name: String(raw.name ?? "Professional"),
          specialty: (raw.specialty as string | null) ?? null,
          district: (raw.district as string | null) ?? null,
          slug: (raw.slug as string | null) ?? null,
          languages: normalizeLanguages(raw.languages),
          avatarUrl: toPublicAvatarUrl(raw.avatar_url),
        };
      });
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
    if (activeDistrict && row.district !== activeDistrict) return false;
    if (
      activeSpecialty &&
      !(row.specialty ?? "").toLowerCase().includes(activeSpecialty.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const filteredManual = manualRows.filter((row) => {
    if (activeDistrict && row.district !== activeDistrict) return false;
    if (
      activeSpecialty &&
      !row.specialty.toLowerCase().includes(activeSpecialty.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const unifiedResults = [
    ...filteredRegistered.map((row) => ({ kind: "registered" as const, row })),
    ...filteredManual.map((row) => ({ kind: "manual" as const, row })),
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div>
            <PendingLink
              href="/"
              className="inline-flex transition hover:opacity-90"
            >
              <DocCyWordmark />
            </PendingLink>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Find a Professional</h1>
            <p className="mt-2 text-sm text-slate-400">
              Search professionals by district and specialty across registered and curated listings.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-emerald-300/20 bg-slate-900/60 p-4 shadow-[0_0_40px_-18px_rgba(16,185,129,0.4)]">
          <FinderFilters
            districts={districts}
            activeDistrict={activeDistrict}
            activeSpecialty={activeSpecialty}
          />
        </section>

        <FinderResultsTransition>
          {dataWarning ? (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {dataWarning}
            </div>
          ) : null}

          <section className="mt-8">
            <article className="rounded-2xl border border-emerald-300/30 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-slate-900/40 p-5 shadow-[0_0_32px_-14px_rgba(16,185,129,0.8)]">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/90">
                    Be seen first.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-100 sm:text-base">
                    Professionals already subscribed appear first in this list and get more
                    attention from day one.
                  </p>
                </div>
                <div className="md:justify-self-end">
                  <PendingLink
                    href="/register"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-300/60 bg-slate-950/80 px-5 py-2.5 text-sm font-semibold text-emerald-200 transition hover:border-emerald-200 hover:bg-slate-900 md:w-auto"
                  >
                    Become a Founding Member
                  </PendingLink>
                </div>
              </div>
            </article>
          </section>

          <section className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {unifiedResults.map((item) => {
                if (item.kind === "registered") {
                  const row = item.row;
                  return (
                    <article
                      key={`registered-${row.id}`}
                      className="flex h-full min-h-[248px] flex-col rounded-2xl border border-emerald-400/20 bg-slate-900/70 p-4 shadow-[0_0_22px_-12px_rgba(52,211,153,0.55)]"
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
                          <p className="mt-1.5 text-sm font-medium leading-snug text-slate-400">
                            {row.specialty ?? "Specialty not set"}
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
                    className="flex h-full min-h-[248px] flex-col rounded-2xl border border-slate-700 bg-slate-900/65 p-4"
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
                        <p className="mt-1.5 text-sm font-medium leading-snug text-slate-400">
                          {row.specialty}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{row.district}</p>
                      </div>
                    </div>

                    <div className="mt-4 min-h-[64px]">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Location
                      </p>
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
                      href="/register"
                      className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                    >
                      Claim your professional profile
                    </PendingLink>
                  </article>
                );
              })}
              {unifiedResults.length === 0 ? (
                <p className="text-sm text-slate-500">No professionals match these filters.</p>
              ) : null}
            </div>
          </section>
        </FinderResultsTransition>
      </div>
    </main>
  );
}
