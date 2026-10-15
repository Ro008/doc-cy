export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { formatInTimeZone } from "date-fns-tz";
import { ScrollFade } from "@/components/navigation/ScrollFade";
import { VisitsFilters } from "@/components/visits/VisitsFilters";
import { VisitsFreshness } from "@/components/visits/VisitsFreshness";
import { VisitsLink } from "@/components/visits/VisitsLink";
import { CY_TZ } from "@/lib/appointments";
import { PastVisitsList } from "@/components/visits/PastVisitsList";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { loadPastVisitFacetRows, loadVisitClinicNames } from "@/lib/past-visit-facets";
import { pastVisitFacets, patientVisitCounts, visitClinicMap } from "@/lib/past-visits-view";
import {
  PAST_VISITS_PAGE_SIZE,
  countPastVisitsWithoutNotes,
  PAST_VISITS_PATH,
  loadPastVisits,
  parsePastVisitsParams,
  pastVisitsHref,
} from "@/lib/past-visits";

export default async function PastVisitsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const doctorRes = await supabase.from("professionals").select("id, name").eq("auth_user_id", user.id).single();
  if (doctorRes.error || !doctorRes.data) redirect("/agenda");
  const doctor = doctorRes.data;

  const query = parsePastVisitsParams(searchParams ?? {});
  const [{ rows, total, failed, patientName, page }, missingNotesCount, locations, facetRows] = await Promise.all([
    loadPastVisits(supabase, { professionalId: doctor.id, query }),
    countPastVisitsWithoutNotes(supabase, doctor.id),
    loadDoctorLocations(doctor.id),
    loadPastVisitFacetRows(supabase, doctor.id),
  ]);

  // The clinics and services of her visits, not the ones she has today: a visit keeps showing
  // where it took place after she leaves that clinic (user, 2026-10-13).
  const facets = pastVisitFacets(facetRows);
  const currentClinicIds = locations.map((l) => l.clinic_id).filter((id): id is string => Boolean(id));
  const clinicInfo = visitClinicMap(
    await loadVisitClinicNames([...facets.clinicIds, ...rows.map((r) => r.clinic_id ?? "")]),
    currentClinicIds,
  );
  // Her current clinics first, in her order; then the ones she has left, by name.
  const clinicOptions = Object.entries(clinicInfo)
    .map(([clinicId, info]) => ({ clinicId, ...info }))
    .sort((a, b) => {
      const ai = currentClinicIds.indexOf(a.clinicId);
      const bi = currentClinicIds.indexOf(b.clinicId);
      if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : Infinity) - (bi >= 0 ? bi : Infinity);
      return a.name.localeCompare(b.name);
    });
  const visitCounts = patientVisitCounts(rows, facetRows);

  const serviceNames = Array.from(new Set([...facets.serviceNames, ...(query.service ? [query.service] : [])]));

  const filtered = Boolean(
    query.q || query.from || query.to || query.clinicId || query.service || query.attendance !== "all" || query.notes !== "all" || query.patientId,
  );
  const pages = Math.max(1, Math.ceil(total / PAST_VISITS_PAGE_SIZE));

  return (
    <main className="min-h-screen bg-pro-page text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Visits</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            Your past visits, newest first, with the patient&apos;s details and your private notes.
          </p>
        </header>

        <VisitsFreshness href={pastVisitsHref(query)} />
        <VisitsFilters
          key={pastVisitsHref(query)}
          action={PAST_VISITS_PATH}
          q={query.q}
          from={query.from}
          to={query.to}
          attendance={query.attendance}
          service={query.service}
          clinicId={query.clinicId}
          notes={query.notes}
          patientId={query.patientId}
          missingNotesCount={missingNotesCount}
          loadedAt={Date.now()}
          serviceNames={serviceNames}
          clinics={clinicOptions.map((c) => ({
            clinicId: c.clinicId,
            name: c.former ? `${c.name} (left)` : c.name,
            swatch: c.swatch,
          }))}
          todayKey={formatInTimeZone(new Date(), CY_TZ, "yyyy-MM-dd")}
          filtered={filtered}
        />

        {/* Dimmed while a filter's results load (the filters form is the `peer`). */}
        <div
          data-testid="past-visits-results"
          className="flex flex-col gap-6 transition-opacity duration-200 peer-aria-busy:opacity-50"
        >
        {query.patientId ? (
          <p
            data-testid="past-visits-patient-banner"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-clinical-500/30 bg-clinical-500/10 px-4 py-2.5 text-sm text-clinical-100"
          >
            <span>
              Visits with <strong className="font-semibold">{patientName ?? "this patient"}</strong>
              <span className="text-clinical-200/70"> (matched on email or phone)</span>
            </span>
            <VisitsLink href={pastVisitsHref(query, { patientId: null, page: 1 })} className="text-clinical-200 underline-offset-2 hover:underline">
              Show all visits
            </VisitsLink>
          </p>
        ) : null}

        {failed ? (
          <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            We couldn&apos;t load your visits. Please reload the page.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-pro-line/70 bg-pro-card px-4 py-6 text-center text-sm text-slate-400" data-testid="past-visits-empty">
            {filtered ? "No visits match these filters." : "Your past visits will show up here once you've seen patients."}
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500" data-testid="past-visits-count">
              {total} {total === 1 ? "visit" : "visits"}
              {filtered ? " found" : ""}
            </p>
            <PastVisitsList
              visits={rows}
              clinics={clinicInfo}
              showClinicColours={clinicOptions.length > 1}
              patientVisitCounts={visitCounts}
            />
            {pages > 1 ? (
              <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
                {page > 1 ? (
                  <VisitsLink href={pastVisitsHref(query, { page: page - 1 })} className="text-clinical-200 hover:underline">
                    ← Newer
                  </VisitsLink>
                ) : (
                  <span />
                )}
                <span className="text-xs text-slate-500">
                  Page {Math.min(page, pages)} of {pages}
                </span>
                {page < pages ? (
                  <VisitsLink href={pastVisitsHref(query, { page: page + 1 })} className="text-clinical-200 hover:underline">
                    Older →
                  </VisitsLink>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}
        </div>
      </div>
      <ScrollFade testId="visits-scroll-fade" />
    </main>
  );
}
