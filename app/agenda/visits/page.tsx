export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { PastVisitsList } from "@/components/visits/PastVisitsList";
import { locationsToAgendaClinics } from "@/lib/agenda-clinics";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import {
  PAST_VISITS_PAGE_SIZE,
  PAST_VISITS_PATH,
  loadPastVisits,
  parsePastVisitsParams,
  pastVisitsHref,
} from "@/lib/past-visits";

const FIELD =
  "mt-1 w-full rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40";
const LABEL = "text-[11px] font-medium uppercase tracking-wide text-slate-400";

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
  const [{ rows, total, failed }, locations, servicesRes] = await Promise.all([
    loadPastVisits(supabase, { professionalId: doctor.id, query }),
    loadDoctorLocations(doctor.id),
    supabase.from("professional_services").select("name").eq("professional_id", doctor.id).order("name"),
  ]);

  const clinics = locationsToAgendaClinics(locations).filter((c) => c.clinicId);
  const multiClinic = clinics.length > 1;
  const clinicNames: Record<string, string> = multiClinic
    ? Object.fromEntries(clinics.map((c) => [c.clinicId as string, c.name]))
    : {};

  const serviceNames = Array.from(
    new Set([
      ...((servicesRes.data ?? []) as { name: string | null }[]).map((s) => s.name?.trim() ?? "").filter(Boolean),
      ...(query.service ? [query.service] : []),
    ]),
  );

  const filtered = Boolean(
    query.q || query.from || query.to || query.clinicId || query.service || query.attendance !== "all",
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

        <form
          method="get"
          action={PAST_VISITS_PATH}
          role="search"
          aria-label="Search visits"
          data-testid="past-visits-search"
          className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4"
        >
          <div>
            <label htmlFor="visits-q" className={LABEL}>
              Search
            </label>
            <input
              id="visits-q"
              name="q"
              type="search"
              defaultValue={query.q}
              maxLength={100}
              placeholder="Patient name, email or phone, reason, service or notes"
              className={FIELD}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="visits-from" className={LABEL}>
                From
              </label>
              <input id="visits-from" name="from" type="date" defaultValue={query.from ?? ""} className={FIELD} />
            </div>
            <div>
              <label htmlFor="visits-to" className={LABEL}>
                To
              </label>
              <input id="visits-to" name="to" type="date" defaultValue={query.to ?? ""} className={FIELD} />
            </div>
            <div>
              <label htmlFor="visits-attendance" className={LABEL}>
                Attendance
              </label>
              <select id="visits-attendance" name="attendance" defaultValue={query.attendance} className={FIELD}>
                <option value="all">All</option>
                <option value="attended">Attended</option>
                <option value="no_show">No-shows</option>
              </select>
            </div>
            {serviceNames.length > 0 ? (
              <div>
                <label htmlFor="visits-service" className={LABEL}>
                  Service
                </label>
                <select id="visits-service" name="service" defaultValue={query.service ?? ""} className={FIELD}>
                  <option value="">All services</option>
                  {serviceNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {multiClinic ? (
              <div>
                <label htmlFor="visits-clinic" className={LABEL}>
                  Clinic
                </label>
                <select id="visits-clinic" name="clinic" defaultValue={query.clinicId ?? ""} className={FIELD}>
                  <option value="">All clinics</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.clinicId as string}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl border border-clinical-500/40 bg-clinical-500/10 px-4 py-2 text-sm font-semibold text-clinical-200 transition hover:border-clinical-400/60 hover:bg-clinical-500/20"
            >
              Search
            </button>
            {filtered ? (
              <a href={PAST_VISITS_PATH} className="text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">
                Clear filters
              </a>
            ) : null}
          </div>
        </form>

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
            <PastVisitsList visits={rows} clinicNames={clinicNames} />
            {pages > 1 ? (
              <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
                {query.page > 1 ? (
                  <a href={pastVisitsHref(query, { page: query.page - 1 })} className="text-clinical-200 hover:underline">
                    ← Newer
                  </a>
                ) : (
                  <span />
                )}
                <span className="text-xs text-slate-500">
                  Page {Math.min(query.page, pages)} of {pages}
                </span>
                {query.page < pages ? (
                  <a href={pastVisitsHref(query, { page: query.page + 1 })} className="text-clinical-200 hover:underline">
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
    </main>
  );
}
