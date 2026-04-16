import Link from "next/link";
import { startOfMonth, startOfWeek, subMonths } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { InternalDirectoryClient } from "@/components/internal/InternalDirectoryClient";
import {
  PendingSpecialtiesPanel,
  type PendingSpecialtyRow,
} from "@/components/internal/PendingSpecialtiesPanel";
import { InternalSignOutButton } from "@/components/internal/InternalSignOutButton";
import { FounderKpiCards } from "@/components/internal/FounderKpiCards";
import { SpecialtyBreakdown } from "@/components/internal/SpecialtyBreakdown";
import { LanguageDistribution } from "@/components/internal/LanguageDistribution";
import {
  RecentActivityFeed,
  type RecentAppointmentRow,
} from "@/components/internal/RecentActivityFeed";
import { AppointmentsGrowthChart } from "@/components/internal/AppointmentsGrowthChart";
import {
  aggregateLanguages,
  aggregateSpecialties,
} from "@/lib/founder-metrics";
import { buildLastSixMonthsAppointmentCounts } from "@/lib/founder-appointments-by-month";
import { cyprusMonthStartUtcIso } from "@/lib/cyprus-calendar";
import { fetchResendAccountQuota } from "@/lib/resend-quota";
import { TrialConversionTable } from "@/components/internal/TrialConversionTable";
import { getTrialPeriodDays } from "@/lib/trial-period";
import { WebsiteAnalyticsPanel } from "@/components/internal/WebsiteAnalyticsPanel";
import {
  buildHighInterestSessions,
  buildLocalityRanking,
  buildPopularSections,
  type WebsiteVisitRow,
} from "@/lib/website-analytics";

/** Always run on the server per request — no static cache of dashboard numbers */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FounderDashboardPage() {
  const supabase = createServiceRoleClient();

  if (!supabase) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-200">
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
          <h1 className="text-lg font-semibold text-amber-100">Configuration required</h1>
          <p className="mt-2 text-sm text-amber-100/90">
            Add <code className="rounded bg-black/30 px-1">SUPABASE_SERVICE_ROLE_KEY</code> to
            your environment so this page can load analytics (server-side only). Never expose this
            key to the browser.
          </p>
          <Link href="/internal" className="mt-6 inline-block text-sm text-emerald-300 hover:underline">
            ← Back to gate
          </Link>
        </div>
      </main>
    );
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStartIso = cyprusMonthStartUtcIso();
  const chartRangeStart = startOfMonth(subMonths(new Date(), 5));

  const [
    doctorsRes,
    apptCountRes,
    apptsMonthCountRes,
    appts7dRes,
    recentApptsRes,
    apptsForChartRes,
    resendQuotaRes,
    websiteVisitsRes,
  ] = await Promise.all([
    supabase
      .from("doctors")
      .select(
        "id, name, email, phone, slug, specialty, languages, status, created_at, license_number, license_file_url, is_specialty_approved"
      )
      .order("created_at", { ascending: false }),
    supabase.from("appointments").select("id", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStartIso),
    supabase.from("appointments").select("doctor_id").gte("created_at", sevenDaysAgoIso),
    supabase
      .from("appointments")
      .select("id, patient_name, appointment_datetime, created_at, doctor_id")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("appointments")
      .select("created_at")
      .gte("created_at", chartRangeStart.toISOString()),
    fetchResendAccountQuota(),
    supabase
      .from("website_visits")
      .select("session_id, page_path, city, country, traffic_origin, ref_code, created_at")
      .gte("created_at", sevenDaysAgoIso),
  ]);

  const resendLiveQuota = resendQuotaRes.ok ? resendQuotaRes.quota : null;
  const resendQuotaFailureReason =
    "reason" in resendQuotaRes ? resendQuotaRes.reason : null;

  if (doctorsRes.error) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-200">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-lg font-semibold text-red-100">
            Could not load professionals
          </h1>
          <p className="mt-2 text-sm text-red-100/90">{doctorsRes.error.message}</p>
          <Link href="/internal" className="mt-6 inline-block text-sm text-emerald-300 hover:underline">
            ← Back to gate
          </Link>
        </div>
      </main>
    );
  }

  let recentApptRowsRaw: {
    id: unknown;
    patient_name: unknown;
    appointment_datetime: unknown;
    doctor_id: unknown;
    created_at?: unknown;
  }[] = [];

  if (!recentApptsRes.error && recentApptsRes.data) {
    recentApptRowsRaw = recentApptsRes.data;
  } else {
    const fallback = await supabase
      .from("appointments")
      .select("id, patient_name, appointment_datetime, doctor_id, created_at")
      .order("appointment_datetime", { ascending: false })
      .limit(5);
    recentApptRowsRaw = fallback.data ?? [];
  }

  const rawDoctors = doctorsRes.data ?? [];
  const rows = rawDoctors.map((d) => ({
    id: d.id as string,
    name: d.name as string,
    email: (d as { email?: string | null }).email ?? null,
    phone: (d as { phone?: string | null }).phone ?? null,
    slug: (d.slug as string | null) ?? null,
    specialty: (d.specialty as string | null) ?? null,
    languages: Array.isArray(d.languages)
      ? (d.languages as string[])
      : d.languages
        ? [String(d.languages)]
        : [],
    status: (d.status as string | null) ?? null,
    license_number: (d as { license_number?: string | null }).license_number ?? null,
    license_file_url: (d as { license_file_url?: string | null }).license_file_url ?? null,
    created_at: (d as { created_at?: string | null }).created_at ?? null,
    is_specialty_approved:
      (d as { is_specialty_approved?: boolean | null }).is_specialty_approved ?? true,
  }));

  const pendingRes = await supabase
    .from("doctors")
    .select("id, name, specialty, email")
    .eq("is_specialty_approved", false)
    .order("created_at", { ascending: false });

  const pendingSpecialtyItems: PendingSpecialtyRow[] =
    pendingRes.error || !pendingRes.data
      ? []
      : pendingRes.data.map((r) => ({
          id: r.id as string,
          name: (r.name as string) ?? "—",
          specialty: (r as { specialty?: string | null }).specialty ?? null,
          email: (r as { email?: string | null }).email ?? null,
        }));

  const verifiedRows = rows.filter(
    (r) => (r.status ?? "").trim().toLowerCase() === "verified"
  );
  const totalDoctors = verifiedRows.length;
  const pendingDoctorsCount = rows.filter(
    (r) => (r.status ?? "").trim().toLowerCase() === "pending"
  ).length;
  const totalAppointments = apptCountRes.error ? 0 : apptCountRes.count ?? 0;
  const appointmentsThisMonth = apptsMonthCountRes.error
    ? 0
    : apptsMonthCountRes.count ?? 0;

  let activeDoctors7d = 0;
  if (!appts7dRes.error && appts7dRes.data?.length) {
    activeDoctors7d = Array.from(
      new Set(appts7dRes.data.map((a) => a.doctor_id as string))
    ).length;
  }

  const newDoctorsThisWeek = verifiedRows.filter((r) => {
    if (!r.created_at) return false;
    return new Date(r.created_at) >= weekStart;
  }).length;

  const chartRows =
    !apptsForChartRes.error && apptsForChartRes.data
      ? (apptsForChartRes.data as { created_at: string | null }[])
      : [];
  const chartData = buildLastSixMonthsAppointmentCounts(chartRows);

  const specialtyItems = aggregateSpecialties(verifiedRows);
  const languageItems = aggregateLanguages(verifiedRows);

  const doctorIds = Array.from(
    new Set(recentApptRowsRaw.map((a) => a.doctor_id as string))
  );
  const nameById: Record<string, string> = {};
  if (doctorIds.length > 0) {
    const { data: docRows } = await supabase
      .from("doctors")
      .select("id, name")
      .in("id", doctorIds);
    for (const d of docRows ?? []) {
      nameById[d.id as string] = (d.name as string) ?? "";
    }
  }

  const activityItems: RecentAppointmentRow[] = recentApptRowsRaw.map((a) => {
    const created = (a.created_at as string | null | undefined) ?? null;
    return {
      id: a.id as string,
      patient_name: (a.patient_name as string) ?? "Patient",
      appointment_datetime: a.appointment_datetime as string,
      booked_at_iso: created,
      doctor_id: a.doctor_id as string,
      doctor_name: nameById[a.doctor_id as string] ?? null,
    };
  });
  const trialPeriodDays = getTrialPeriodDays();
  const websiteVisitRows =
    !websiteVisitsRes.error && websiteVisitsRes.data
      ? (websiteVisitsRes.data as WebsiteVisitRow[])
      : [];
  const totalVisitsLast7d = websiteVisitRows.length;
  const topLocalities = buildLocalityRanking(websiteVisitRows);
  const popularSections = buildPopularSections(websiteVisitRows);
  const highInterestSessions = buildHighInterestSessions(websiteVisitRows);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 mx-auto h-96 max-w-4xl rounded-full bg-emerald-600/[0.07] blur-3xl" />
        <div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-violet-600/[0.06] blur-3xl" />
      </div>

      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-500/90">
              Founder
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white lg:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Platform health · professionals · bookings · live data
            </p>
          </div>
          <InternalSignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-8">
        {pendingDoctorsCount > 0 ? (
          <section className="rounded-2xl border border-amber-500/45 bg-amber-500/10 p-5 shadow-lg shadow-black/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/95">
                  Action required
                </p>
                <h2 className="mt-1 text-lg font-semibold text-amber-100">
                  {pendingDoctorsCount} pending professional
                  {pendingDoctorsCount === 1 ? "" : "s"} waiting for your review
                </h2>
                <p className="mt-1 text-sm text-amber-100/85">
                  Open the professional directory to verify, reject, or map specialties.
                </p>
              </div>
              <Link
                href="#professional-directory"
                className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-amber-900/30 transition hover:bg-amber-200"
              >
                Go to Professional Directory
              </Link>
            </div>
          </section>
        ) : null}

        <FounderKpiCards
          totalDoctors={totalDoctors}
          totalAppointments={totalAppointments}
          appointmentsThisMonth={appointmentsThisMonth}
          activeDoctors7d={activeDoctors7d}
          newDoctorsThisWeek={newDoctorsThisWeek}
          resendLiveQuota={resendLiveQuota}
          resendQuotaFailureReason={resendQuotaFailureReason}
        />

        <PendingSpecialtiesPanel items={pendingSpecialtyItems} />
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 p-3 text-xs text-slate-400">
          Trial policy: <span className="font-medium text-slate-200">{trialPeriodDays} days</span>{" "}
          from registration date.
        </div>
        <TrialConversionTable doctors={verifiedRows} />
        <WebsiteAnalyticsPanel
          totalVisitsLast7d={totalVisitsLast7d}
          topLocalities={topLocalities}
          popularSections={popularSections}
          highInterestSessions={highInterestSessions}
        />

        <div className="grid gap-6 xl:grid-cols-12">
          {/* Mobile: activity under KPIs; desktop: right rail */}
          <div className="order-2 space-y-6 xl:order-1 xl:col-span-8">
            <AppointmentsGrowthChart data={chartData} />

            <div className="grid gap-6 md:grid-cols-2">
              <SpecialtyBreakdown items={specialtyItems} />
              <LanguageDistribution items={languageItems} totalDoctorCount={totalDoctors} />
            </div>

            <section
              id="professional-directory"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/25 p-5 shadow-inner shadow-black/20 backdrop-blur-sm"
            >
              <div className="mb-5 flex flex-col gap-1 border-b border-slate-800/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Professional directory
                  </h2>
                  <p className="text-xs text-slate-500">Search, filter, open public profiles</p>
                </div>
              </div>
              <InternalDirectoryClient doctors={rows} />
            </section>
          </div>

          <div className="order-1 xl:order-2 xl:col-span-4">
            <RecentActivityFeed items={activityItems} />
          </div>
        </div>
      </div>
    </main>
  );
}
