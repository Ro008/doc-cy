export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { formatInTimeZone } from "date-fns-tz";
import { ScrollFade } from "@/components/navigation/ScrollFade";
import { VisitsFilters } from "@/components/visits/VisitsFilters";
import { CY_TZ } from "@/lib/appointments";
import { PastVisitsList, type VisitClinicInfo } from "@/components/visits/PastVisitsList";
import { locationsToAgendaClinics } from "@/lib/agenda-clinics";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { agendaClinicEventColor } from "@/lib/doctor-locations";
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
  const [{ rows, total, failed, patientName, page }, missingNotesCount, locations, servicesRes] = await Promise.all([
    loadPastVisits(supabase, { professionalId: doctor.id, query }),
    countPastVisitsWithoutNotes(supabase, doctor.id),
    loadDoctorLocations(doctor.id),
    supabase.from("professional_services").select("name").eq("professional_id", doctor.id).order("name"),
  ]);

  const clinics = locationsToAgendaClinics(locations).filter((c) => c.clinicId);
  const multiClinic = clinics.length > 1;
  const clinicInfo: Record<string, VisitClinicInfo> = multiClinic
    ? Object.fromEntries(
        clinics.map((c, i) => [c.clinicId as string, { name: c.name, swatch: agendaClinicEventColor(i).swatch }]),
      )
    : {};

  const serviceNames = Array.from(
    new Set([
      ...((servicesRes.data ?? []) as { name: string | null }[]).map((s) => s.name?.trim() ?? "").filter(Boolean),
      ...(query.service ? [query.service] : []),
    ]),
  );

  const filtered = Boolean(
    query.q || query.from || query.to || query.clinicId || query.service || query.attendance !== "all" || query.notes !== "all" || query.patientId,
  );
  const pages = Math.max(1, Math.ceil(total / PAST_VISITS_PAGE_SIZE));

  return (
    <main className="min-h-screen bg-ink-900 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Visits</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            Your past visits, newest first. Open one to see the patient&apos;s details and edit your private notes.
          </p>
        </header>

        <VisitsFilters
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
          serviceNames={serviceNames}
          clinics={clinics.map((c, i) => ({
            clinicId: c.clinicId as string,
            name: c.name,
            swatch: agendaClinicEventColor(i).swatch,
          }))}
          todayKey={formatInTimeZone(new Date(), CY_TZ, "yyyy-MM-dd")}
          filtered={filtered}
        />

        {query.patientId ? (
          <p
            data-testid="past-visits-patient-banner"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-clinical-500/30 bg-clinical-500/10 px-4 py-2.5 text-sm text-clinical-100"
          >
            <span>
              Visits with <strong className="font-semibold">{patientName ?? "this patient"}</strong>
              <span className="text-clinical-200/70"> (matched on email or phone)</span>
            </span>
            <a href={pastVisitsHref(query, { patientId: null, page: 1 })} className="text-clinical-200 underline-offset-2 hover:underline">
              Show all visits
            </a>
          </p>
        ) : null}

        {failed ? (
          <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            We couldn&apos;t load your visits. Please reload the page.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-slate-700/70 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-400" data-testid="past-visits-empty">
            {filtered ? "No visits match these filters." : "Your past visits will show up here once you've seen patients."}
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500" data-testid="past-visits-count">
              {total} {total === 1 ? "visit" : "visits"}
              {filtered ? " found" : ""}
            </p>
            <PastVisitsList visits={rows} clinics={clinicInfo} />
            {pages > 1 ? (
              <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
                {page > 1 ? (
                  <a href={pastVisitsHref(query, { page: page - 1 })} className="text-clinical-200 hover:underline">
                    ← Newer
                  </a>
                ) : (
                  <span />
                )}
                <span className="text-xs text-slate-500">
                  Page {Math.min(page, pages)} of {pages}
                </span>
                {page < pages ? (
                  <a href={pastVisitsHref(query, { page: page + 1 })} className="text-clinical-200 hover:underline">
                    Older →
                  </a>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}
      </div>
      <ScrollFade testId="visits-scroll-fade" />
    </main>
  );
}
